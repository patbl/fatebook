import { ChartBarIcon, HomeIcon } from "@heroicons/react/24/solid"
import clsx from "clsx"
import { useRouter } from "next/router"
import { ReactNode } from "react"
import Footer from "./Footer"
import { Navbar } from "./Navbar"
import { useUserId } from "../lib/web/utils"

export function Layout({
  children,
  showForSlackButton = true,
  showCreateAccountButton = true,
  showNavbar = true,
}: {
  children: ReactNode
  showForSlackButton?: boolean
  showNavbar?: boolean
  showCreateAccountButton?: boolean
}) {
  const main = (
    <main className="bg-neutral-50 grow pb-8 lg:pb-12">{children}</main>
  )
  return (
    <>
      <div className="flex flex-col min-h-screen ">
        {showNavbar && (
          <Navbar
            showForSlackButton={showForSlackButton}
            showCreateAccountButton={showCreateAccountButton}
          >
            {main}
          </Navbar>
        )}

        {!showNavbar && main}

        <BottomNav />
        <div className="hidden lg:block">
          <Footer />
        </div>
        <div className="py-12 lg:hidden bg-neutral-50"></div>
      </div>
    </>
  )
}

function BottomNav() {
  const router = useRouter()
  const userId = useUserId()

  // only show when logged in
  if (!userId) return <></>

  // only show on homepage and stats page
  if (router.pathname !== "/" && router.pathname !== "/stats") return <></>

  return (
    <div className="btm-nav z-[500] lg:hidden">
      {[
        {
          path: "/",
          title: "Home",
          icon: <HomeIcon width={24} />,
        },
        {
          path: "/stats",
          title: "Stats",
          icon: <ChartBarIcon width={24} />,
        },
      ].map(({ path, icon, title }) => (
        <button
          key={title}
          className={clsx("text-primary", router.pathname === path && "active")}
          onClick={() => void router.push(path)}
        >
          {icon}
        </button>
      ))}
    </div>
  )
}
