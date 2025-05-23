import { Popover, Transition } from "@headlessui/react"
import {
  ChevronDownIcon,
  LinkIcon,
  LockClosedIcon,
  UserGroupIcon,
  UsersIcon,
} from "@heroicons/react/20/solid"
import clsx from "clsx"
import Image from "next/image"
import Link from "next/link"
import React, { Fragment, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { ReactMultiEmail } from "react-multi-email"
import "react-multi-email/dist/style.css"
import { getQuestionUrl } from "../lib/web/question_url"
import { api } from "../lib/web/trpc"
import { invalidateQuestion, useUserId } from "../lib/web/utils"
import { QuestionWithStandardIncludes } from "../prisma/additional"
import { CopyToClipboard } from "./CopyToClipboard"
import { UserListDropdown } from "./UserListDropdown"

export function SharePopover({
  question,
}: {
  question: QuestionWithStandardIncludes
}) {
  const sharedToSlack =
    !!question.questionMessages && question.questionMessages.length > 0
  return (
    <div className="">
      <Popover as="div" className="inline-block text-left relative w-full">
        <div className="w-full text-right md:text-center">
          <Popover.Button className="button text-sm">
            {question.sharedPublicly ? (
              question.unlisted ? (
                <>
                  <LinkIcon height={15} /> <span>Shared link</span>
                </>
              ) : (
                <>
                  <UserGroupIcon height={15} /> <span>Public</span>
                </>
              )
            ) : question.sharedWith?.length > 0 ||
              question.sharedWithLists?.length > 0 ||
              sharedToSlack ? (
              <>
                <UsersIcon height={15} /> <span>Shared</span>
              </>
            ) : (
              <>
                <LockClosedIcon height={15} /> <span>Only me</span>
              </>
            )}
            <ChevronDownIcon
              className="-mr-2 h-5 w-5 text-neutral-400"
              aria-hidden="true"
            />
          </Popover.Button>
        </div>

        <Transition
          as={Fragment}
          enter="transition duration-100 ease-out"
          enterFrom="transform scale-95 opacity-0"
          enterTo="transform scale-100 opacity-100"
          leave="transition duration-75 ease-out"
          leaveFrom="transform scale-100 opacity-100"
          leaveTo="transform scale-95 opacity-0"
        >
          <SharePanel question={question} />
        </Transition>
      </Popover>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const SharePanel = React.forwardRef<
  HTMLDivElement,
  { question: QuestionWithStandardIncludes }
>(function SharePanel(
  {
    question,
  }: {
    question: QuestionWithStandardIncludes
  },
  forwardedRef,
) {
  const sharedToSlack =
    !!question.questionMessages && question.questionMessages.length > 0

  const permalink = api.getSlackPermalink.useQuery(
    question.questionMessages?.length > 0
      ? {
          ...question.questionMessages[0]!.message,
        }
      : undefined,
  )
  const [showInstructions, setShowInstructions] = React.useState(false)

  const handleShareToSlack = () => {
    const questionUrl = getQuestionUrl(question, false)
    void navigator.clipboard.writeText(`/forecast ${questionUrl}`)
    setShowInstructions(true)
  }

  return (
    <Popover.Panel
      className="absolute z-50 w-full cursor-auto"
      ref={forwardedRef}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute z-50 mt-2 w-72 md:w-96 lg:w-[29rem] right-0 md:left-0 origin-top-right divide-y divide-neutral-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
        <div className="p-4 flex flex-col gap-2">
          <EmailInput question={question} />
          <UserListDropdown question={question} />
          <SharePublicly question={question} />
          {sharedToSlack ? (
            <div>
              <Image
                src="/slack-logo.svg"
                width={30}
                height={30}
                className="m-0 -ml-2 inline"
                alt=""
              />
              <span className="text-sm">
                {permalink.data ? (
                  <Link href={permalink.data} target="_blank">
                    Shared in Slack
                  </Link>
                ) : (
                  "Shared in Slack"
                )}
              </span>
            </div>
          ) : (
            <div>
              <span className="text-sm">
                <button className="btn" onClick={handleShareToSlack}>
                  <Image
                    src="/slack-logo.svg"
                    width={30}
                    height={30}
                    className="m-0 -mx-2 inline"
                    alt=""
                  />
                  Share in Slack
                  {showInstructions && " (command copied!)"}
                </button>
                {showInstructions && (
                  <div className="mt-2 bg-neutral-50 rounded-md p-2">
                    <span className="font-semibold">
                      Paste into a Slack channel to share this question there
                    </span>
                    <span className="block text-neutral-400 italic">
                      Make sure{" "}
                      <Link href="/for-slack" target="_blank">
                        Fatebook for Slack
                      </Link>{" "}
                      is installed first
                    </span>
                  </div>
                )}
              </span>
            </div>
          )}
        </div>
      </div>
    </Popover.Panel>
  )
})

function SharePublicly({
  question,
}: {
  question: QuestionWithStandardIncludes
}) {
  const userId = useUserId()
  const utils = api.useContext()
  const setSharedPublicly = api.question.setSharedPublicly.useMutation({
    async onSuccess() {
      await invalidateQuestion(utils, question)
    },
  })
  return (
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 justify-between">
          <div className="flex gap-2">
            <input
              id="sharePublicly"
              type="checkbox"
              className={clsx(
                userId !== question.userId && "cursor-not-allowed",
              )}
              disabled={
                userId !== question.userId || setSharedPublicly.isLoading
              }
              checked={question.sharedPublicly}
              onChange={(e) => {
                setSharedPublicly.mutate({
                  questionId: question.id,
                  sharedPublicly: e.target.checked,
                })
              }}
            />
            <label htmlFor="sharePublicly" className="text-sm my-auto">
              Share with anyone with the link
            </label>
          </div>
          {question.sharedPublicly && (
            <CopyToClipboard textToCopy={getQuestionUrl(question, false)} />
          )}
        </div>
      </div>
      {question.sharedPublicly && (
        <div className="flex gap-2">
          <input
            id="unlisted"
            type="checkbox"
            className={clsx(userId !== question.userId && "cursor-not-allowed")}
            disabled={userId !== question.userId || setSharedPublicly.isLoading}
            checked={!question.unlisted}
            onChange={(e) => {
              setSharedPublicly.mutate({
                questionId: question.id,
                unlisted: !e.target.checked,
              })
            }}
          />
          <label htmlFor="unlisted" className="text-sm my-auto">
            {"Show on the "}
            <Link href="/public" onClick={(e) => e.stopPropagation()}>
              public questions page
            </Link>
          </label>
        </div>
      )}
    </ErrorBoundary>
  )
}

function EmailInput({ question }: { question: QuestionWithStandardIncludes }) {
  const [emails, setEmails] = useState<string[]>(
    question.sharedWith.map((user) => user.email),
  )
  const userId = useUserId()
  const utils = api.useContext()
  const setSharedWith = api.question.setSharedWith.useMutation({
    async onSuccess() {
      await invalidateQuestion(utils, question)
    },
  })

  if (userId !== question.userId) {
    if (question.sharedWith.length > 0) {
      return (
        <label className="text-sm">
          <span className="font-semibold">Shared with</span>{" "}
          {question.sharedWith.map((user) => user.email).join(", ")}
        </label>
      )
    } else {
      return <></>
    }
  }
  return (
    <>
      <label className="block text-sm font-medium text-neutral-700">
        Share with
      </label>
      <ReactMultiEmail
        className={clsx("text-sm", setSharedWith.isLoading && "opacity-50")}
        placeholder="alice@gmail.com bob@gmail.com"
        delimiter=" "
        emails={emails}
        onChange={(emails: string[]) => {
          setEmails(emails)
        }}
        onBlur={() => {
          setSharedWith.mutate({
            questionId: question.id,
            sharedWith: emails,
          })
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setSharedWith.mutate({
              questionId: question.id,
              sharedWith: emails,
            })
          }
        }}
        getLabel={(email, index, removeEmail) => {
          return (
            <div data-tag key={index}>
              <div data-tag-item>{email}</div>
              <span data-tag-handle onClick={() => removeEmail(index)}>
                ×
              </span>
            </div>
          )
        }}
      />
    </>
  )
}
