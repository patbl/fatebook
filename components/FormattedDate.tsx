import clsx from "clsx"
import { intlFormatDistance } from "date-fns"
import { HTMLAttributes, ReactNode } from "react"
import { getDateYYYYMMDD } from "../lib/_utils_common"

export function FormattedDate({
  date,
  prefix,
  postfix,
  className,
  alwaysUseDistance = false,
  capitalise = false,
  currentDateShowToday = false,
  hoverTooltip = true,
  includeTime = true,
}: {
  date: Date | undefined
  prefix?: ReactNode | string
  postfix?: ReactNode | string
  className?: HTMLAttributes<HTMLSpanElement>["className"]
  alwaysUseDistance?: boolean
  capitalise?: boolean
  currentDateShowToday?: boolean
  hoverTooltip?: boolean
  includeTime?: boolean
}) {
  const oneWeekMs = 1000 * 60 * 60 * 24 * 7

  if (!date) {
    return <></>
  }

  const showDistance =
    alwaysUseDistance ||
    (date.getTime() <= Date.now() &&
      Date.now() - date.getTime() <= oneWeekMs * 8) ||
    (date.getTime() > Date.now() && date.getTime() - Date.now() < oneWeekMs)

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "June",
    "July",
    "Aug",
    "Sept",
    "Oct",
    "Nov",
    "Dec",
  ]
  const day = date.getDate()
  const monthIndex = date.getMonth()
  const suffix = [1, 21, 31].includes(day)
    ? "st"
    : [2, 22].includes(day)
      ? "nd"
      : [3, 23].includes(day)
        ? "rd"
        : "th"
  const fullDate =
    `${monthNames[monthIndex]} ` +
    `${day}${suffix}` +
    `${
      date.getFullYear() !== new Date().getFullYear()
        ? ` ${date.getFullYear()}`
        : ""
    }`

  let formattedDate
  try {
    formattedDate = showDistance
      ? currentDateShowToday &&
        getDateYYYYMMDD(date) === getDateYYYYMMDD(new Date())
        ? "today"
        : intlFormatDistance(date, new Date())
      : fullDate
  } catch (e) {
    console.error(e)
    return <></>
  }

  return (
    <span
      className={clsx(hoverTooltip && `md:tooltip`, className)}
      suppressHydrationWarning={true}
      data-tip={`${getDateYYYYMMDD(date)}${
        includeTime ? ` at ${date.toLocaleTimeString()}` : ""
      }`}
    >
      {prefix}
      {capitalise
        ? formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)
        : formattedDate}
      {postfix}
    </span>
  )
}
