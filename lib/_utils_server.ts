import {
  DayOfTheWeek,
  PrismaClient,
  SlackMessage,
  Target,
  TargetType,
} from "@prisma/client"
import { ModalView } from "@slack/types"
import fetch from "node-fetch"
import {
  PingSlackMessageWithMessage,
  ProfileWithUser,
  QuestionSlackMessageWithMessage,
  QuestionWithAuthorAndAllMessages,
  QuestionWithForecastWithUserWithProfilesAndSlackMessages,
  ResolutionSlackMessageWithMessage,
  UserWithProfiles,
} from "../prisma/additional"
import { buildQuestionBlocks } from "./blocks-designs/question"
import { buildQuestionResolvedBlocks } from "./blocks-designs/question_resolved"
import { buildResolveQuestionBlocks } from "./blocks-designs/resolve_question"

import { TEST_WORKSPACES } from "./_constants"
import { conciseDateTime, unixTimestamp } from "./_utils_common"
import { Blocks } from "./blocks-designs/_block_utils"

// Intialise prisma, use this method to avoid multiple intialisations in `next dev`
// Source: https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices#solution
const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined
}
const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["info", "warn", "error"]
        : ["warn", "error"],
  })
export default prisma
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export type PostAnyMessageAdditionalArgs = {
  as_user?: boolean
  icon_emoji?: string
  icon_url?: string
  link_names?: boolean
  parse?: string
  thread_ts?: string
  username?: string
}

export type PostClearMessageAdditionalArgs = PostAnyMessageAdditionalArgs & {
  metadata?: string
  mrkdwn?: boolean
  reply_broadcast?: boolean
  unfurl_links?: boolean
  unfurl_media?: boolean
}

export type PostMessagePayload = PostClearMessageAdditionalArgs & {
  channel: string
  text: string
  blocks?: Blocks
}

export type PostEphemeralMessageAdditionalArgs =
  PostAnyMessageAdditionalArgs & {
    attachments?: string
  }

type PostEphemeralMessagePayload = PostEphemeralMessageAdditionalArgs & {
  channel: string
  text: string
  user: string
  blocks?: Blocks
}

// tokenize a string into an array by splitting on sections
// in the following syntax, with two strings and one number:
// "forecast" "date" 0.8
export function tokenizeForecastString(instring: string): string[] | null {
  const regex = /([a-zA-Z_]+)\s?(["“][^"”]*["”])?\s?("?[^"\s]*"?)?\s?([\d.]*)?/
  const array: string[] | null = instring.match(regex)
  console.log("Tokenized version:", array)
  return array
}

export async function getToken(teamId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: {
      teamId: teamId,
    },
  })
  if (!workspace) {
    throw new Error("Workspace not found for team id " + teamId)
  }
  return workspace.token
}

export function getUserNameOrProfileLink(
  teamId: string,
  user: UserWithProfiles,
): string {
  const thisTeamsProfile = user.profiles.find((p) => p.slackTeamId === teamId)
  return thisTeamsProfile
    ? `<@${thisTeamsProfile.slackId}>`
    : user.name || "Anon User"
}

export async function getSlackProfileFromSlackId(
  teamId: string,
  slackId: string,
) {
  let data
  try {
    const url = "https://slack.com/api/users.info"
    const response = await fetch(url + `?user=${slackId}`, {
      method: "get",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${await getToken(teamId)}`,
      },
    })
    data = await response.json()
    console.log("data from user fetch:", data)
  } catch (err) {
    console.log("fetch email Error:", err)
    throw err
  }

  const slackProfile = (data as any).user.profile
  if (slackProfile === undefined) {
    throw new Error("slackProfile not found")
  }
  console.log("slackUser found:", slackProfile)
  return slackProfile
}

export async function getOrCreateProfile(teamId: string, slackUserId: string) {
  // query the database for the user
  //   we use findFirst because we expect only one result
  //   cannot get unique because we don't have a unique on
  //   uncertain field
  let profile = await prisma.profile.findFirst({
    where: {
      slackId: slackUserId,
    },
    include: {
      user: true,
    },
  })

  // if no profile, create one
  if (!profile) {
    try {
      profile = await createProfile(teamId, slackUserId)
    } catch (err) {
      console.error(`Couldn't create profile for slackUserID: ${slackUserId}`)
      throw new Error(
        `Couldn't create profile for slackUserId: ${slackUserId}. ${err}`,
      )
    }
  }

  return profile
}

export async function createProfile(
  teamId: string,
  slackId: string,
): Promise<ProfileWithUser> {
  // check if the user exists
  const slackProfile = await getSlackProfileFromSlackId(teamId, slackId)
  const email = slackProfile.email
  const realName = slackProfile.real_name

  let user = await prisma.user.findUnique({
    where: {
      email: email,
    },
  })

  // if the user doesn't exist in our db, create them
  //   and create a profile for them
  const profileData = {
    slackId: slackId,
    slackTeamId: teamId,
  }
  if (!user) {
    await prisma.user.create({
      data: {
        email: email,
        name: realName,
        image: slackProfile.image_512,
        profiles: {
          create: profileData,
        },
      },
    })
    await backendAnalyticsEvent("new_user", {
      platform: "slack",
      team: teamId,
    })
  } else {
    // create the profile if they don't exist
    await prisma.profile.create({
      data: {
        ...profileData,
        userId: user.id,
      },
    })
    await backendAnalyticsEvent("new_profile_for_existing_user", {
      platform: "slack",
      team: teamId,
    })
  }
  // see above for why findFirst is used
  //   we now have a profile, so we can return it
  let profile = await prisma.profile.findFirst({
    where: {
      slackId: slackId,
    },
    include: {
      user: true,
    },
  })
  if (profile === undefined) {
    throw new Error(
      `db error, failed to find created profile with slackId: ${slackId}`,
    )
  }
  return profile!
}

export function tokenizeString(instring: string) {
  const array: string[] = instring.split(" ").filter((element) => {
    return element !== ""
  })
  console.log("Tokenized version:", array)
  return array
}

export async function getSlackPermalinkFromChannelAndTS(
  messageTeamId: string,
  channel: string,
  timestamp: string,
) {
  const url = `https://slack.com/api/chat.getPermalink?channel=${channel}&message_ts=${timestamp}`
  try {
    const data = (await callSlackApi(
      messageTeamId,
      null,
      url,
      "get",
      true,
    )) as { ok: boolean; permalink: string }
    if (data?.ok === false) {
      console.warn(`Could not get link for ${channel} and ${timestamp}:`, data)
    }
    return data?.permalink
  } catch (err) {
    console.warn(
      `Could not get link for ${channel} and ${timestamp}. Continuing.`,
    )
  }
}

export async function postBlockMessage(
  teamId: string,
  channel: string,
  blocks: Blocks,
  notificationText: string = "",
  additionalArgs: PostClearMessageAdditionalArgs = {},
) {
  return await postSlackMessage(teamId, {
    channel,
    text: notificationText, // this is the fallback text, it shows up in e.g. system notifications
    blocks,
    ...(additionalArgs
      ? { ...additionalArgs }
      : { unfurl_links: false, unfurl_media: false }), // default to not unfurling links
  })
}

export async function postTextMessage(
  teamId: string,
  channel: string,
  payload: string,
  additionalArgs: PostClearMessageAdditionalArgs = {},
) {
  await postSlackMessage(teamId, {
    channel,
    text: payload,
    ...(additionalArgs && { ...additionalArgs }),
  })
}

export async function postEphemeralBlockMessage(
  teamId: string,
  channel: string,
  user: string,
  blocks: Blocks,
  notificationMessage: string,
  additionalArgs: PostEphemeralMessageAdditionalArgs = {},
) {
  await postEphemeralSlackMessage(teamId, {
    channel,
    blocks,
    text: notificationMessage,
    user,
    ...(additionalArgs && { ...additionalArgs }),
  })
}

export async function postEphemeralTextMessage(
  teamId: string,
  channel: string,
  user: string,
  payload: string,
  additionalArgs: PostEphemeralMessageAdditionalArgs = {},
) {
  await postEphemeralSlackMessage(teamId, {
    channel,
    text: payload,
    user,
    ...(additionalArgs && { ...additionalArgs }),
  })
}

async function handleChannelNotFoundError(
  response: { ok: boolean; error?: string; channel?: string; ts?: string },
  teamId: string,
  attemptedChannel: string,
  userId: string | undefined,
) {
  console.log("in func`")
  if (response.ok === false) {
    console.log("false")
    if (userId && response.error === "channel_not_found") {
      console.log("bl")
      await postEphemeralSlackMessage(teamId, {
        channel: userId, // DM the user
        user: userId,
        text: `Oops, this bot is not in that channel. Invite me to <#${attemptedChannel}> first by tagging me, or use a public channel. (Note that Slack doesn't let you add bots to DMs).`,
      })
      console.log(
        "Notified user about err posting Slack message channel_not_found (Bot is not in that channel).",
      )
      return { ...response, notifiedUserAboutEmptyChannel: true }
    } else {
      console.error(`Error posting Slack message:`, response.error)
      throw new Error(`Error posting Slack message: ${response.error}`)
    }
  }

  return response
}

export async function postSlackMessage(
  teamId: string,
  message: PostMessagePayload,
  userId?: string,
) {
  // console.log(`Posting message to channel: ${message.channel}, text: ${message.text}, blocks: `, JSON.stringify(message?.blocks))
  const url = "https://slack.com/api/chat.postMessage"
  const response = await callSlackApi(teamId, message, url, "POST", !userId) // don't throw if we have the user ID (we can maybe DM them an ephemeral)
  return await handleChannelNotFoundError(
    response,
    teamId,
    message.channel,
    userId,
  )
}

export async function postEphemeralSlackMessage(
  teamId: string,
  message: PostEphemeralMessagePayload,
) {
  console.log(
    `Posting ephemeral message to channel: ${message.channel}, text: ${message.text}, blocks: `,
    message?.blocks,
  )

  const url = "https://slack.com/api/chat.postEphemeral"
  return (await callSlackApi(teamId, message, url)) as {
    ok: boolean
    ts: string
  }
}

export async function updateMessage(
  teamId: string,
  message: { channel: string; ts: string; text: string; blocks?: Blocks },
  logToConsole: boolean = true,
  userId?: string,
) {
  logToConsole &&
    console.log(
      `Updating message to channel: ${message.channel}, text: ${message.text}`,
    )

  const url = "https://slack.com/api/chat.update"
  const response = await callSlackApi(teamId, message, url, "POST", !userId) // don't throw if we have the user ID (we can maybe DM them an ephemeral)

  return await handleChannelNotFoundError(
    response,
    teamId,
    message.channel,
    userId,
  )
}

export async function deleteMessage(
  teamId: string,
  channel: string,
  ts: string,
) {
  console.log(`Deleting message from channel: ${channel}, ts: ${ts}`)

  const url = "https://slack.com/api/chat.delete"
  return (await callSlackApi(teamId, { channel, ts }, url)) as { ok: boolean }
}

export async function showModal(
  teamId: string,
  triggerId: string,
  view: ModalView,
) {
  console.log("Showing modal view: ", view)

  const response = (await callSlackApi(
    teamId,
    {
      trigger_id: triggerId,
      view,
    },
    "https://slack.com/api/views.open",
  )) as { ok: boolean; view: { id: string } }

  return response
}

export async function getChannelInfo(teamId: string, channel: string) {
  console.log(`Getting users from channel: ${channel}`)

  const url = "https://slack.com/api/conversations.info"
  return (await callSlackApi(teamId, { channel }, url, "GET", false)) as {
    ok: boolean
    error?: string
    needed?: string
  }
}

export async function channelVisible(teamId: string, channel: string) {
  const channelInfoResponse = await getChannelInfo(teamId, channel)
  if (channelInfoResponse.error === "missing_scope") {
    console.log(
      `Missing scope to read channel info: ${channelInfoResponse.needed}`,
    )
    // because we don't have mpim:read scope to read info of group DMs Fatebook is in, we assume it's in the group DM
    return true
  }
  return channelInfoResponse.ok
}

export async function callSlackApi(
  teamId: string,
  message: any,
  url: string,
  method = "POST",
  throwOnError = false,
) {
  const postRequest = method === "POST"
  if (!postRequest) {
    url += `?${new URLSearchParams(message).toString()}`
  }

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${await getToken(teamId)}`,
    },
    ...(postRequest && message && { body: JSON.stringify(message) }),
  })
  let data = (await response.json()) as {
    ok: boolean
    error?: string
    ts?: string
    channel?: string
    response_metadata?: any
    permalink?: string
  }
  if (data.ok === false) {
    if (
      (data.error == "channel_not_found" &&
        url.startsWith("https://slack.com/api/conversations.info")) || // expect channel_not_found when checking if channel is visible
      (data.error == "missing_scope" &&
        url.startsWith("https://slack.com/api/conversations.info")) // older slacks don't have right scopes
    ) {
      const modifiedResponse = JSON.stringify(data).replace("error", "slackerr")
      console.log(
        "Non-okay response calling Slack API:",
        { response: modifiedResponse, message, url },
        JSON.stringify(message, null, 2),
      )
    } else {
      console.error(
        "Error calling Slack API:",
        { response: JSON.stringify(data), message, url },
        JSON.stringify(message, null, 2),
      )
    }
    if (throwOnError)
      throw new Error(
        `Error calling Slack API ${data.error} ${JSON.stringify(
          data.response_metadata,
        )}`,
      )
  }
  return data
}

interface ResponseMessage {
  text: string
  response_type?: "in_channel" | "ephemeral"
  replace_original: boolean
  blocks?: Blocks
  thread_ts?: string
  [key: string]: any
}

export async function postMessageToResponseUrl(
  message: ResponseMessage,
  responseUrl: string,
) {
  console.log(
    `\nPosting message to response url: ${responseUrl}: `,
    JSON.stringify(message, null, 2),
  )
  const response = await fetch(responseUrl, {
    method: "post",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(message),
  })

  if (response.ok === false) {
    console.error("Error posting message:", await response.text())
    throw new Error(`Error posting message to response URL`)
  }

  return await response.text()
}

async function updateSlackMessages<QuestionX>(
  slackMessages: SlackMessage[],
  notificationMessage: string,
  question: QuestionX,
  updateBlocks: (
    teamId: string,
    question: QuestionX,
  ) => Promise<Blocks> | Blocks,
) {
  console.log(`Updating messages for question ${(question as any)?.id}`)
  for (const slackMessage of slackMessages) {
    console.log(`Updating message to channel: ${slackMessage.channel}`)
    const response = await updateMessage(
      slackMessage.teamId,
      {
        channel: slackMessage.channel,
        ts: slackMessage.ts,
        text: notificationMessage,
        blocks: await updateBlocks(slackMessage.teamId, question),
      },
      false,
    )
    if (!response.ok) {
      console.error("Error updating message: ", response)
    }
  }
}

// Note that this will not update the scores
export async function updateResolutionQuestionMessages(
  question: QuestionWithAuthorAndAllMessages,
  notificationMessage: string,
) {
  await updateSlackMessages(
    question.resolutionMessages.map(
      (x: ResolutionSlackMessageWithMessage) => x.message,
    ),
    notificationMessage,
    question,
    buildQuestionResolvedBlocks,
  )
}

export async function updateResolvePingQuestionMessages(
  question: QuestionWithAuthorAndAllMessages,
  notificationMessage: string,
) {
  await updateSlackMessages(
    question.pingResolveMessages.map(
      (x: PingSlackMessageWithMessage) => x.message,
    ),
    notificationMessage,
    question,
    buildResolveQuestionBlocks,
  )
}

export async function updateForecastQuestionMessages(
  question: QuestionWithForecastWithUserWithProfilesAndSlackMessages,
  notificationMessage: string,
) {
  await updateSlackMessages(
    question.questionMessages.map(
      (x: QuestionSlackMessageWithMessage) => x.message,
    ),
    notificationMessage,
    question,
    buildQuestionBlocks,
  )
}

// date_num: 2020-12-31
// date_short_pretty: Dec 31, 2020 or tomorrow / yesterday / today where appropriate
export function getDateSlackFormat(
  date: Date,
  includeTime: boolean = false,
  dateFormat: "date_num" | "date_short_pretty" = "date_num",
  lowerCase = true,
) {
  const fallbackText = conciseDateTime(date, includeTime)

  // e.g. <!date^1392734382^{date_num} at {time}|2014-02-18 6:39:42 AM PST>
  return `<!date^${unixTimestamp(date)}^${lowerCase ? " " : ""}{${dateFormat}}${
    includeTime ? " at {time}" : ""
  }|${fallbackText}>`
}

export interface AnalyticsEventParams {
  platform: "slack" | "web" | "discord"
  team?: string
  [key: string]: any
}
export async function backendAnalyticsEvent(
  name: string,
  params: AnalyticsEventParams,
) {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  const apiSecret = process.env.G_ANALYTICS_MEASUREMENT_PROTOCOL_SECRET

  if (
    process.env.NODE_ENV !== "production" ||
    (params.team && TEST_WORKSPACES.includes(params.team))
  ) {
    console.log(
      "Skipping analytics event because test workspace or not in production: ",
      name,
    )
    return
  }

  if (!measurementId || !apiSecret) {
    console.log(
      "Missing g analytics measurement ID or API secret. (Ignore unless in production)",
    )
    return
  }

  const res = await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
    {
      method: "POST",
      body: JSON.stringify({
        client_id: "fatebook-backend",
        events: [
          {
            name,
            params: {
              session_id: Date.now() + 123, // There's a limit of 500 events per session so need to be ~unique
              engagement_time_msec: 100,
              ...params,
            },
          },
        ],
      }),
    },
  )
  if (!res.ok) {
    console.error("Error sending analytics event", res.text(), res)
  }
}

export async function userHasTarget(fatebookUserId: string) {
  return (await getTarget(fatebookUserId)) !== null
}

export async function getTarget(fatebookUserId: string) {
  return await prisma.target.findFirst({
    where: {
      userId: fatebookUserId,
    },
  })
}

export function dateToDayEnum(date: Date): DayOfTheWeek {
  const dayNumber = date.getDay()
  switch (dayNumber) {
    case 0:
      return DayOfTheWeek.SUNDAY
    case 1:
      return DayOfTheWeek.MONDAY
    case 2:
      return DayOfTheWeek.TUESDAY
    case 3:
      return DayOfTheWeek.WEDNESDAY
    case 4:
      return DayOfTheWeek.THURSDAY
    case 5:
      return DayOfTheWeek.FRIDAY
    case 6:
      return DayOfTheWeek.SATURDAY
    default:
      throw new Error("Invalid day number")
  }
}

export function dayEnumToNum(day: DayOfTheWeek): number {
  switch (day) {
    case DayOfTheWeek.SUNDAY:
      return 0
    case DayOfTheWeek.MONDAY:
      return 1
    case DayOfTheWeek.TUESDAY:
      return 2
    case DayOfTheWeek.WEDNESDAY:
      return 3
    case DayOfTheWeek.THURSDAY:
      return 4
    case DayOfTheWeek.FRIDAY:
      return 5
    case DayOfTheWeek.SATURDAY:
      return 6
    default:
      throw new Error("Invalid day enum")
  }
}

export function dayEnumToStr(day: DayOfTheWeek): string {
  switch (day) {
    case DayOfTheWeek.SUNDAY:
      return "Sunday"
    case DayOfTheWeek.MONDAY:
      return "Monday"
    case DayOfTheWeek.TUESDAY:
      return "Tuesday"
    case DayOfTheWeek.WEDNESDAY:
      return "Wednesday"
    case DayOfTheWeek.THURSDAY:
      return "Thursday"
    case DayOfTheWeek.FRIDAY:
      return "Friday"
    case DayOfTheWeek.SATURDAY:
      return "Saturday"
    default:
      throw new Error("Invalid day enum")
  }
}

export function sameDate(date1: Date, date2: Date) {
  return (
    date1.getFullYear() == date2.getFullYear() &&
    date1.getMonth() == date2.getMonth() &&
    date1.getDate() == date2.getDate()
  )
}

export async function getCurrentTargetProgress(
  fatebookUserId: string,
  target: Target,
) {
  let count = 0
  let previousPeriodStart = target.lastNotified
  switch (target.type) {
    case TargetType.FORECAST:
      count = await prisma.forecast.count({
        where: {
          userId: fatebookUserId,
          createdAt: {
            gte: previousPeriodStart,
          },
        },
      })
      break
    case TargetType.QUESTION:
      count = await prisma.question.count({
        where: {
          userId: fatebookUserId,
          createdAt: {
            gte: previousPeriodStart,
          },
        },
      })
      break
    default:
      throw new Error(`Unknown target type ${target.type}`)
  }
  return count
}
