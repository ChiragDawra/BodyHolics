/**
 * Every user-facing string in the app lives here.
 *
 * Nothing renders text it hardcodes. This is the seam a second language
 * (Hindi, Punjabi) goes through later without touching a component.
 *
 * House style, from the design pipeline:
 *   - Name things as a member would say them.
 *   - Buttons say what happens ("Show my code"), not what the form does.
 *   - An action keeps its name through the flow.
 *   - Empty states invite action.
 *   - Errors say what broke and what to do about it.
 *   - Sentence case. No exclamation marks. No emoji.
 */

export const strings = {
  app: {
    name: "BodyHolics",
    shortName: "BodyHolics",
    staffShortName: "BH Staff",
    description: "Membership, check-ins, and gym updates for BodyHolics.",
  },

  /* ---------------------------------------------------------------- public */

  landing: {
    title: "BodyHolics",
    tagline: "Iron, chalk, and a fan that actually works.",
    lede: "Check whether the gym is open, see how busy it is, and keep your membership in your pocket.",
    joinCta: "Join the gym",
    openMemberApp: "Open my app",
    hoursHeading: "Opening hours",
    plansHeading: "Memberships",
    weekdays: "Monday to Friday",
    weekends: "Saturday and Sunday",
    closed: "Closed",
    perDuration: (days: number) =>
      days === 30
        ? "a month"
        : days === 90
          ? "3 months"
          : days === 180
            ? "6 months"
            : days === 365
              ? "a year"
              : `${days} days`,
  },

  join: {
    title: "Join BodyHolics",
    intro: "Sign in with Google and your membership lives on your phone.",
    verifying: "Checking that link",
    invalidCode: "That join link is not valid",
    invalidCodeBody:
      "Ask at the desk for the current join link, or scan the code on the wall again.",
    signInWithGoogle: "Continue with Google",
    signInFailed: "Couldn't sign you in",
    signInFailedBody:
      "Google didn't complete the sign-in. Check your connection and try again.",
    whatYouGet: "What you get",
    benefits: [
      "See whether the gym is open before you leave home",
      "Check how busy it is right now",
      "Know exactly when your membership ends",
    ],
    footnote: "We only read your name, email, and profile photo from Google.",
  },

  /* ---------------------------------------------------------------- member */

  member: {
    homeTitle: "Today",
    activityTitle: "Activity",
    meTitle: "Me",

    tabs: {
      home: "Home",
      activity: "Activity",
      me: "Me",
    },

    greeting: (name: string | null) =>
      name ? `Hello, ${name.split(" ")[0]}` : "Hello",

    gymOpen: "Open now",
    gymClosed: "Closed now",
    opensAt: (time: string) => `Opens at ${time}`,
    closesAt: (time: string) => `Closes at ${time}`,
    closedToday: "Closed today",

    crowdHeading: "How busy it is",
    crowd: {
      not_crowded: "Not crowded",
      moderate: "Filling up",
      crowded: "Crowded",
      very_crowded: "Very crowded",
    },
    crowdCaption: {
      not_crowded: "Plenty of free racks.",
      moderate: "You may wait for a bench.",
      crowded: "Most stations are busy.",
      very_crowded: "Expect to wait for everything.",
    },
    crowdUpdated: (relative: string) => `Updated ${relative}`,
    crowdUnknown: "Not set yet",

    membershipHeading: "My membership",
    membershipActive: "Active",
    membershipExpired: "Expired",
    membershipCancelled: "Cancelled",
    membershipEnds: (date: string) => `Ends ${date}`,
    membershipEnded: (date: string) => `Ended ${date}`,
    membershipDaysLeft: (days: number) =>
      days === 0 ? "Last day" : days === 1 ? "1 day left" : `${days} days left`,
    membershipExpiringSoon: "Renew at the desk to keep training.",
    noMembership: "No membership yet",
    noMembershipBody: "Ask at the desk to start one. It shows up here straight away.",

    visitsThisMonth: (n: number) =>
      n === 1 ? "1 visit this month" : `${n} visits this month`,

    activityEmpty: "No visits yet",
    activityEmptyBody: "Your first check-in will appear here.",
    activityTotal: (n: number) => (n === 1 ? "1 visit" : `${n} visits`),
    lastVisit: (relative: string) => `Last visit ${relative}`,

    profileHeading: "Profile",
    membershipDetailsHeading: "Membership details",
    plan: "Plan",
    started: "Started",
    ends: "Ends",
    status: "Status",
    signOut: "Sign out",
    installApp: "Add to home screen",

    alertsTitle: "Updates from the gym",
    alertsEmpty: "No updates yet",
    alertsEmptyBody: "Notices from the gym will show up here.",
    alertsUnread: (n: number) => `${n} unread`,
    openAlerts: "Open updates",
  },

  /* ----------------------------------------------------------------- check */

  check: {
    title: "Quick check",
    pinPrompt: "Enter your PIN",
    pinHint: "4 digits",
    pinWrong: "That PIN is not right",
    pinLocked: "Unlocked",
    backspace: "Delete last digit",
    digit: (n: number) => `Digit ${n}`,

    dashboardTitle: "BodyHolics",
    todayHeading: "Checked in today",
    todayCount: (n: number) => (n === 1 ? "1 person" : `${n} people`),
    activeMembers: "Active members",

    crowdHeading: "How busy is it",
    openHeading: "Open or closed",
    openNow: "Open",
    closedNow: "Closed",
    followSchedule: "Follow hours",
    forceOpen: "Force open",
    forceClosed: "Force closed",
    scheduleNote: "Following the usual hours",
    overrideNote: "Overriding the usual hours",

    recentHeading: "Just checked in",
    recentEmpty: "Nobody yet today",
    recentEmptyBody: "Check-ins recorded at the desk show up here.",

    alertHeading: "Send an update",
    alertTitleLabel: "Title",
    alertTitlePlaceholder: "Closing early today",
    alertBodyLabel: "Details",
    alertBodyPlaceholder: "Shutting at 6pm for maintenance.",
    publishAlert: "Send to members",
    publishing: "Sending",
    published: "Sent",
    alertNeedsTitle: "Give the update a title before sending it.",

    lock: "Lock",
    saving: "Saving",
    saved: "Saved",
  },

  /* ----------------------------------------------------------------- admin */

  admin: {
    title: "Dashboard",
    signInTitle: "Staff sign-in",
    signInBody: "This dashboard is for BodyHolics staff.",
    signInWithGoogle: "Continue with Google",
    notStaffTitle: "That account is not staff",
    notStaffBody:
      "Ask the owner to add your Google account to the staff list, then sign in again.",
    signOut: "Sign out",

    nav: {
      members: "Members",
      attendance: "Attendance",
      plans: "Plans",
      settings: "Gym settings",
      alerts: "Alerts",
    },

    members: {
      title: "Members",
      search: "Search by name or email",
      filterAll: "All",
      filterActive: "Active",
      filterExpired: "Expired",
      empty: "No members yet",
      emptyBody: "Members appear here as soon as they sign in with the join link.",
      noMatch: "No members match that search",
      noMatchBody: "Try a shorter search, or clear the filter.",
      count: (n: number) => (n === 1 ? "1 member" : `${n} members`),
      joined: (date: string) => `Joined ${date}`,
      detailTitle: "Member",
      membershipHistory: "Membership history",
      attendanceHistory: "Attendance",
      noMemberships: "No memberships recorded",
      noMembershipsBody: "Give this member a plan to start their membership.",
      noAttendance: "No visits recorded",
      noAttendanceBody: "Check them in from the Attendance page.",
      giveMembership: "Give a membership",
      startMembership: "Start membership",
      backToMembers: "Back to members",
    },

    attendance: {
      title: "Attendance",
      todayHeading: "Today",
      checkInHeading: "Check someone in",
      searchMember: "Search for a member",
      searchHint: "Type at least two letters",
      checkIn: "Check in",
      checkingIn: "Checking in",
      checkedIn: "Checked in",
      alreadyIn: "Already checked in today",
      undo: "Undo",
      empty: "Nobody has checked in today",
      emptyBody: "Search for a member above and check them in.",
      noResults: "No members match that name",
      noResultsBody: "Try a shorter search.",
      count: (n: number) => (n === 1 ? "1 check-in" : `${n} check-ins`),
    },

    plans: {
      title: "Plans",
      newPlan: "New plan",
      editPlan: "Edit plan",
      name: "Name",
      namePlaceholder: "Monthly",
      price: "Price",
      duration: "Length in days",
      active: "Active",
      inactive: "Inactive",
      activate: "Activate",
      deactivate: "Deactivate",
      save: "Save plan",
      saving: "Saving",
      empty: "No plans yet",
      emptyBody: "Create the plans you already sell at the desk.",
      inactiveNote: "Inactive plans stay on existing memberships but are not offered to new members.",
    },

    settings: {
      title: "Gym settings",
      hoursHeading: "Opening hours",
      hoursNote: "Members see these on the home screen.",
      openLabel: "Opens",
      closeLabel: "Closes",
      closedLabel: "Closed",
      overrideHeading: "Open or closed right now",
      overrideNote: "An override beats the schedule until you clear it.",
      followSchedule: "Follow the schedule",
      forceOpen: "Force open",
      forceClosed: "Force closed",
      crowdHeading: "How busy it is",
      joinHeading: "Join link",
      joinNote: "Print this or put it on the wall. Members open it with their own camera app.",
      copyLink: "Copy link",
      copied: "Copied",
      save: "Save changes",
      saving: "Saving",
      saved: "Saved",
    },

    alerts: {
      title: "Alerts",
      composeHeading: "New alert",
      titleLabel: "Title",
      titlePlaceholder: "Closing early today",
      bodyLabel: "Details",
      bodyPlaceholder: "Shutting at 6pm for maintenance.",
      publish: "Publish to members",
      publishing: "Publishing",
      published: "Published",
      sentHeading: "Sent",
      empty: "No alerts sent yet",
      emptyBody: "Members see these the moment you publish.",
      needsTitle: "Give the alert a title before publishing it.",
      delete: "Delete",
    },
  },

  /* --------------------------------------------------------------- install */

  install: {
    title: "Add BodyHolics to your phone",
    lede: "It opens like an app, works on a bad signal, and takes one tap from your home screen.",
    androidCta: "Add to home screen",
    androidFallbackTitle: "Use your browser menu",
    androidFallbackBody:
      "Open the browser menu and choose Install app, or Add to home screen.",
    iosTitle: "Add it from Safari",
    iosSteps: [
      "Tap the Share button at the bottom of Safari.",
      "Scroll down and tap Add to Home Screen.",
      "Tap Add. BodyHolics appears with your other apps.",
    ],
    webviewTitle: "Open this in your browser first",
    webviewBody:
      "You are inside another app right now, which cannot add to the home screen. Copy the link and open it in Safari or Chrome.",
    copyLink: "Copy link",
    copied: "Link copied",
    skip: "Skip for now",
    alreadyInstalled: "Already installed. Opening the app.",
  },

  /* ---------------------------------------------------------------- shared */

  common: {
    loading: "Loading",
    retry: "Try again",
    cancel: "Cancel",
    close: "Close",
    save: "Save",
    search: "Search",
    back: "Back",
    notFoundTitle: "That page does not exist",
    notFoundBody: "Check the link, or go back to the start.",
    goHome: "Go to the start",
    networkErrorTitle: "Couldn't reach the gym's server",
    networkErrorBody: "Check your connection and try again.",
    unexpectedTitle: "That did not load",
    unexpectedBody:
      "The screen failed to load. Try again, and tell the desk if it keeps happening.",
    offline: "You are offline. Showing the last thing we loaded.",
    rupees: (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`,
  },
} as const;

export type Strings = typeof strings;
