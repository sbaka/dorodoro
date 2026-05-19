"use client";

import { EyeOff, Eye, LogOut, Settings as SettingsIcon, ArrowRightIcon, MenuIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/app/components/auth-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getUserInitial, getUserLabel } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

type PublicHeaderProps = {
  mode: "public";
  active?: "login" | "signup";
};

type AppHeaderProps = {
  mode: "app";
  active?: "home" | "start" | "settings";
};

type FocusHeaderProps = {
  mode: "focus";
  workspaceHidden?: boolean;
  onToggleWorkspace?: () => void;
};

type SiteHeaderProps = PublicHeaderProps | AppHeaderProps | FocusHeaderProps;

const publicLinks = [
  { href: "/login", label: "Sign in", key: "login" as const },
  { href: "/sign-up", label: "Sign up", key: "signup" as const },
];

const appLinks = [
  { href: "/home", label: "Dashboard", key: "home" as const },
  { href: "/start", label: "Focus", key: "start" as const },
  { href: "/settings", label: "Settings", key: "settings" as const },
];

export function SiteHeader(props: SiteHeaderProps) {
  const router = useRouter();
  const { signOutUser, user } = useAuth();

  async function handleSignOut() {
    await signOutUser();
    router.push("/");
  }

  if (props.mode === "focus") {
    const workspaceHidden = props.workspaceHidden ?? false;
    return (
      <header className="app-header app-header--focus">
        <Link className="brand-link" href="/home">
          <Image
            src="/assets/logo.png"
            alt="DoroDoro logo"
            width={34}
            height={34}
            priority
          />
          <span>DoroDoro</span>
        </Link>

        <nav className="header-actions" aria-label="Focus header">
          {props.onToggleWorkspace ? (
            <button
              type="button"
              className="header-button"
              onClick={props.onToggleWorkspace}
              aria-pressed={workspaceHidden}
            >
              {workspaceHidden ? (
                <Eye className="button-icon size-4" aria-hidden="true" />
              ) : (
                <EyeOff className="button-icon size-4" aria-hidden="true" />
              )}
              <span>{workspaceHidden ? "Show workspace" : "Hide workspace"}</span>
            </button>
          ) : null}
          <Link href="/settings" className="header-button">
            <SettingsIcon className="button-icon size-4" aria-hidden="true" />
            <span>Settings</span>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="profile-chip-trigger"
              aria-label={`Account menu for ${getUserLabel(user)}`}
            >
              <span className="profile-chip">{getUserInitial(user)}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8}>
              <DropdownMenuItem disabled className="opacity-100! cursor-default!">
                <span className="text-xs text-muted-foreground">
                  Signed in as {getUserLabel(user)}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/home")}>
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <SettingsIcon className="size-4" aria-hidden="true" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} variant="destructive">
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </header>
    );
  }

  const links = props.mode === "public" ? publicLinks : appLinks;
  const mobileMenuLabel = props.mode === "public" ? "Open site navigation" : "Open app navigation";

  return (
    <header className={cn("app-header", props.mode === "app" ? "app-header--app" : "app-header--public")}>
      <Link className="brand-link" href={props.mode === "app" ? "/home" : "/"}>
        <Image
          src="/assets/logo.png"
          alt="DoroDoro logo"
          width={34}
          height={34}
          priority
        />
        <span>DoroDoro</span>
      </Link>

      <nav className="header-actions header-actions--desktop" aria-label="Primary navigation">
        {
          props.mode !== "app" ?
            <>
              <Link
                key='login'
                href={"/login"}
                className={props.active === "login" ? "header-button active" : "header-button"}
              >
                {"Sign in"}
              </Link>
              <Link
                key={"signup"}
                href={"/sign-up"}
                className={cn("primary-pill")}
              >
                {"Start free"} <ArrowRightIcon className="button-icon size-4" aria-hidden="true" />
              </Link>
            </>
            :
            links.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                className={cn("header-button", props.active === link.key && "active")}
              >
                {link.label}
              </Link>
            ))
        }
        {props.mode === "app" ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="profile-chip-trigger"
                aria-label={`Account menu for ${getUserLabel(user)}`}
              >
                <span className="profile-chip">{getUserInitial(user)}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8}>
                <DropdownMenuItem disabled className="opacity-100! cursor-default!">
                  <span className="text-xs text-muted-foreground">
                    Signed in as {getUserLabel(user)}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/home")}>
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  <SettingsIcon className="size-4" aria-hidden="true" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} variant="destructive">
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
      </nav>

      <div className="mobile-header-menu">
        <Sheet>
          <SheetTrigger className="mobile-menu-trigger" aria-label={mobileMenuLabel}>
            <MenuIcon className="size-5" aria-hidden="true" />
            <span className="sr-only">Menu</span>
          </SheetTrigger>
          <SheetContent className="mobile-header-sheet" side="right">
            <SheetHeader className="mobile-header-sheet-header">
              <SheetTitle>{props.mode === "public" ? "Menu" : "Navigation"}</SheetTitle>
              <SheetDescription>
                {props.mode === "public"
                  ? "Open DoroDoro pages from one place."
                  : `Signed in as ${getUserLabel(user)}`}
              </SheetDescription>
            </SheetHeader>

            <nav className="mobile-header-nav" aria-label="Mobile navigation">
              {props.mode !== "app" ? (
                <>
                  <Link href="/login" className="mobile-header-link">
                    Sign in
                  </Link>
                  <Link href="/sign-up" className="mobile-header-link mobile-header-link--primary">
                    Start free
                    <ArrowRightIcon className="button-icon size-4" aria-hidden="true" />
                  </Link>
                </>
              ) : (
                <>
                  {links.map((link) => (
                    <Link
                      key={link.key}
                      href={link.href}
                      className={cn("mobile-header-link", props.active === link.key && "active")}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <button type="button" className="mobile-header-link mobile-header-link--destructive" onClick={handleSignOut}>
                    <LogOut className="size-4" aria-hidden="true" />
                    Sign out
                  </button>
                </>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}