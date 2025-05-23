import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { CheckCircleIcon } from "@heroicons/react/24/outline"
import { FunnelIcon } from "@heroicons/react/24/solid"
import clsx from "clsx"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"
import { ExtraFilters } from "../lib/web/question_router"

export function FilterControls({
  extraFilters,
  setExtraFilters,
}: {
  extraFilters: ExtraFilters
  setExtraFilters: (extraFilters: ExtraFilters) => void
}) {
  const [searchVisible, setSearchVisible] = useState(false)
  const [searchString, setSearchString] = useState("")
  const [filterVisible, setFilterVisible] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  useEffect(() => {
    const handleSetSearchString = (event: Event) => {
      console.log({ event })
      const customEvent = event as CustomEvent
      setSearchString(customEvent.detail)
      setSearchVisible(true)
      setExtraFilters({
        ...extraFilters,
        searchString: customEvent.detail,
        resolved: true,
      })
    }
    window.addEventListener("setSearchString", handleSetSearchString)
    return () => {
      window.removeEventListener("setSearchString", handleSetSearchString)
    }
  }, [setSearchString, extraFilters, setExtraFilters, setSearchVisible])

  return (
    <div className="@container grow sm:ml-2">
      <div className="flex flex-row gap-1 justify-end" id="filters">
        {!searchVisible && !isMobile && (
          <button
            onClick={() => setSearchVisible(!searchVisible)}
            className="btn text-neutral-500"
          >
            <MagnifyingGlassIcon height={16} />
          </button>
        )}

        <AnimatePresence mode="popLayout">
          {(searchVisible || isMobile) && (
            <motion.div
              initial={isMobile ? undefined : { opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="relative"
            >
              <input
                type="text"
                value={searchString}
                placeholder="Search..."
                autoFocus={!isMobile}
                onBlur={() => {
                  if (searchString === "") {
                    setSearchVisible(false)
                  }
                }}
                onChange={(e) => {
                  setSearchString(e.target.value)
                  setExtraFilters({
                    ...extraFilters,
                    searchString: e.target.value,
                    resolvingSoon: false,
                  })
                }}
                className="text-sm py-2 px-4 focus:border-indigo-500 outline-none block w-full border-2 border-neutral-300 rounded-md p-4 resize-none disabled:opacity-25 disabled:bg-neutral-100 pr-11 placeholder:text-neutral-400 min-w-[150px]"
              />
              <button
                onClick={() => {
                  setSearchString("")
                  setSearchVisible(false)
                  setExtraFilters({
                    ...extraFilters,
                    searchString: "",
                  })
                }}
                className={clsx(
                  "btn btn-xs absolute right-0 top-0 btn-ghost rounded-full text-neutral-500",
                  isMobile && !searchString && "hidden",
                )}
              >
                <XMarkIcon height={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {
          // show buttons if they fit in the container, otherwise put them in the overflow
        }

        <button
          onClick={() =>
            setExtraFilters({
              ...extraFilters,
              resolved: false,
              readyToResolve: false,
              resolvingSoon: !extraFilters.resolvingSoon,
            })
          }
          className={clsx(
            "btn hidden @xl:block",
            extraFilters.resolvingSoon ? "btn-primary" : "text-neutral-500",
          )}
          disabled={!!searchString}
        >
          {extraFilters.resolvingSoon && (
            <CheckCircleIcon className="inline-flex -ml-2 mr-1" height={16} />
          )}
          Resolving soon
        </button>

        <button
          onClick={() =>
            setExtraFilters({
              ...extraFilters,
              resolved: false,
              resolvingSoon: false,
              readyToResolve: !extraFilters.readyToResolve,
            })
          }
          className={clsx(
            "btn hidden @sm:block",
            extraFilters.readyToResolve ? "btn-primary" : "text-neutral-500",
          )}
        >
          {extraFilters.readyToResolve && (
            <CheckCircleIcon className="inline-flex -ml-2 mr-1" height={16} />
          )}
          Ready to resolve
        </button>

        <button
          onClick={() =>
            setExtraFilters({
              ...extraFilters,
              readyToResolve: false,
              resolvingSoon: false,
              resolved: !extraFilters.resolved,
            })
          }
          className={clsx(
            "btn hidden @xs:block",
            extraFilters.resolved ? "btn-primary" : "text-neutral-500",
          )}
        >
          {extraFilters.resolved && (
            <CheckCircleIcon className="inline-flex -ml-2 mr-1" height={16} />
          )}
          Resolved
        </button>

        <button
          onClick={() => setFilterVisible(!filterVisible)}
          className={clsx(
            "btn text-neutral-500",
            filterVisible && "btn-active",
          )}
        >
          <FunnelIcon height={16} />
        </button>
      </div>

      {
        // overflow filter buttons
      }
      <AnimatePresence mode="popLayout">
        {filterVisible && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full flex flex-row flex-wrap gap-1 justify-end mt-2"
          >
            <button
              onClick={() =>
                setExtraFilters({
                  ...extraFilters,
                  resolved: false,
                  readyToResolve: false,
                  resolvingSoon: !extraFilters.resolvingSoon,
                })
              }
              className={clsx(
                "btn",
                extraFilters.resolvingSoon ? "btn-primary" : "text-neutral-500",
              )}
              disabled={!!searchString}
            >
              {extraFilters.resolvingSoon && (
                <CheckCircleIcon
                  className="inline-flex -ml-2 mr-1"
                  height={16}
                />
              )}
              Resolving soon
            </button>

            <button
              onClick={() =>
                setExtraFilters({
                  ...extraFilters,
                  resolved: false,
                  resolvingSoon: false,
                  readyToResolve: !extraFilters.readyToResolve,
                })
              }
              className={clsx(
                "btn @sm:hidden",
                extraFilters.readyToResolve
                  ? "btn-primary"
                  : "text-neutral-500",
              )}
            >
              {extraFilters.readyToResolve && (
                <CheckCircleIcon
                  className="inline-flex -ml-2 mr-1"
                  height={16}
                />
              )}
              Ready to resolve
            </button>

            <button
              onClick={() =>
                setExtraFilters({
                  ...extraFilters,
                  readyToResolve: false,
                  resolvingSoon: false,
                  resolved: !extraFilters.resolved,
                })
              }
              className={clsx(
                "btn @xs:hidden",
                extraFilters.resolved ? "btn-primary" : "text-neutral-500",
              )}
            >
              {extraFilters.resolved && (
                <CheckCircleIcon
                  className="inline-flex -ml-2 mr-1"
                  height={16}
                />
              )}
              Resolved
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
