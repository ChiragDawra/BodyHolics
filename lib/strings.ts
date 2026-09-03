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
 *
 * The one exception to sentence case is the hero tile on the member home
 * screen, which shouts OPEN or CLOSED. That is the single loud thing in the
 * app and it is deliberate.
 */

export const strings = {
  app: {
    name: "BodyHolics",
    shortName: "BodyHolics",
    description: "Membership, check-ins, and gym updates for BodyHolics.",
  },

  /* ---------------------------------------------------------------- public */

  landing: {
    title: "BodyHolics",
    tagline: "Iron, chalk, and a fan that actually works.",
    lede: "Check whether the gym is open, see how busy it is, and keep your membership in your pocket.",
    joinCta: "Join the gym",
    staffCta: "Staff sign-in",
    openMemberApp: "Open my app",
    plansHeading: "Memberships",
    plansNote: "Pay at the desk. Ask about a discount if you are renewing.",
    hoursHeading: "Opening hours",
    weekdays: "Monday to Friday",
    weekends: "Saturday and Sunday",
    closed: "Closed",
    range: (from: string, to: string) => `${from} – ${to}`,
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

  /* ------------------------------------------------------------- join flow */

  join: {
    brandmark: "BODYHOLICS",
    welcomeTitle: "Welcome to BodyHolics",
    welcomeLede: "Join as a member to get started",
    signInWithGoogle: "Continue with Google",
    footnote: "We only read your name, email, and profile photo.",

    invalidCode: "That join link is not valid",
    invalidCodeBody:
      "Ask at the desk for the current join link, or scan the code on the wall again.",
    signInFailedBody:
      "Google didn't complete the sign-in. Check your connection and try again.",

    detailsTitle: "A few details",
    detailsLede: "The desk needs a number it can reach you on.",
    fullName: "Full name",
    emailFromGoogle: "Email · from Google",
    phone: "Phone number",
    phonePlaceholder: "98765 43210",
    phoneRequired: "Add a number so the desk can reach you.",
    emergency: "Emergency contact · optional",
    emergencyPlaceholder: "Name and number",
    staffCodeHeading: "Have a staff code?",
    staffCodePlaceholder: "Enter code",
    staffCodeHint: "Staff members enter their code here to get admin access.",
    staffCodeAccepted: "Staff",
    submit: "Complete registration",
    submitting: "Saving",

    doneTitle: "You're in",
    doneLede:
      "Add BodyHolics to your home screen. It opens like an app and works on a bad signal.",
    iosHeading: "On iPhone",
    iosBody:
      "Tap Share at the bottom of Safari, scroll to Add to Home Screen, then Add.",
    addToHome: "Add to home screen",
    skip: "Skip for now",
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

    /* The one shout in the app. */
    openLoud: "OPEN",
    closedLoud: "CLOSED",
    live: "live",
    untilTime: (time: string) => `until ${time}`,
    opensAt: (time: string) => `Opens at ${time}`,
    closedToday: "Closed today",

    crowdHeading: "Crowd",
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
      very_crowded: "Expect to wait.",
    },

    rightNow: "Right now",
    inTheGym: "in the gym",
    checkedInNotOut: "Checked in, not out",

    daysLeft: "days left",
    timelineHeading: "Membership timeline",
    timelineStart: "Start",
    timelineToday: "Today",
    timelineExpiry: "Expiry",
    planBenefits: "What this plan includes",
    paymentHistory: "Payment history",
    paymentHistoryEmpty: "No payments yet",
    paymentHistoryEmptyBody: "Anything you pay at the desk shows up here.",
    membershipEndsOn: (date: string) => `Ends ${date}`,
    membershipActive: "Active",
    membershipExpired: "Expired",
    membershipCancelled: "Cancelled",
    noMembership: "No membership yet",
    noMembershipBody:
      "Ask at the desk to start one. It shows up here straight away.",
    choosePlan: "Choose a plan",
    choosePlanBody:
      "Tell the desk which one you want and pay there. It starts the moment they take the money.",
    payAtDesk: "Pay at the desk",
    planFor: (duration: string) => `for ${duration}`,
    noPlans: "No plans on offer yet",
    noPlansBody: "Ask at the desk what memberships they run.",
    discountedFrom: (was: string) => `was ${was}`,

    bestTime: "Best time today",
    bestTimeValue: (hour: string, weekday: string) =>
      `Usually quiet after ${hour} on ${weekday}s`,
    bestTimeUnknown: "Not enough visits yet to call it",

    streak: "day streak",
    streakKeepGoing: (longest: number) =>
      longest === 1
        ? "Keep it going · longest 1 day"
        : `Keep it going · longest ${longest} days`,
    streakBroken: "Start a new streak today",

    visitsThisMonth: (n: number) =>
      n === 1 ? "1 visit this month" : `${n} visits this month`,
    lastVisit: (relative: string) => `Last visit ${relative}`,

    visitsSince: (n: number, date: string) =>
      n === 1 ? `1 visit since ${date}` : `${n} visits since ${date}`,
    visits: "visits",
    visitsCount: (n: number) => (n === 1 ? "visit" : "visits"),
    daysOfMonth: (visited: number, total: number) =>
      `${visited} of ${total} days`,
    activityEmpty: "No visits yet",
    activityEmptyBody: "Your first check-in will appear here.",

    memberSince: (date: string) => `Member since ${date}`,
    price: "Price",
    started: "Started",
    ends: "Ends",
    payment: "Payment",
    nothingDue: "Nothing due · paid at the desk",
    duesOwed: (amount: string) => `${amount} due · pay at the desk`,
    payDues: "Pay dues",
    comingSoon: "Coming soon",
    payToast: "Online payments coming soon. Pay at the desk for now.",
    signOut: "Sign out",

    alertsTitle: "Alerts",
    alertsEmpty: "No updates yet",
    alertsEmptyBody: "Notices from the gym will show up here.",
    openAlerts: "Open alerts",
    unreadCount: (n: number) => `${n} unread`,
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
    writeRejectedBody:
      "The gym's server refused that change. Sign out and back in, then try again.",
    signOut: "Sign out",
    roleLabel: "Admin",
    live: "Live",
    heavyWorkNote: "Heavy work happens on the laptop",

    nav: {
      dashboard: "Dashboard",
      members: "Members",
      revenue: "Revenue",
      attendance: "Attendance",
      alerts: "Alerts",
      settings: "Gym settings",
      more: "More",
    },

    dashboard: {
      title: "Dashboard",
      activeMembers: "Active members",
      newThisMonth: "New this month",
      collectedIn: (month: string) => `Collected in ${month}`,
      pendingDues: "Pending dues",
      acrossMembers: (n: number) =>
        n === 1 ? "across 1 member" : `across ${n} members`,
      vsLastMonth: (n: number) =>
        n === 0
          ? "same as last month"
          : n > 0
            ? `${n} more than last month`
            : `${Math.abs(n)} fewer than last month`,
      percentVsLast: (pct: number, month: string) =>
        pct >= 0 ? `${pct}% above ${month}` : `${Math.abs(pct)}% below ${month}`,
      recentRegistrations: "Recent registrations",
      viewAllMembers: "View all members",
      registrationsThisWeek: (n: number) =>
        n === 1 ? "1 registration this week" : `${n} registrations this week`,
      noRegistrations: "No registrations yet",
      noRegistrationsBody: "New members appear here the moment they sign in.",
      gymStatus: "Gym status",
      inGymNow: (inGym: number, today: number) =>
        `${inGym === 1 ? "member" : "members"} in the gym right now · ${today} check-ins today`,
      revenueTrend: "Revenue trend · last 6 months",
      collectedTotal: (amount: string) => `${amount} collected`,
      checkinsToday: "Check-ins today",
      stillIn: (n: number) => `${n} still in`,
      quickAlert: "Quick alert",
      revenueThisMonth: "Revenue · this month",
      newThisWeek: "New this week",
      countThisMonth: (n: number) => `${n} this month`,
    },

    members: {
      title: "Members",
      countLine: (total: number, active: number) =>
        `${total} total · ${active} active`,
      search: "Search by name, email, or phone",
      addManually: "Add member manually",
      addShort: "Add member",
      filterAll: "All",
      filterActive: "Active",
      filterExpired: "Expired",
      filterNoPlan: "No plan",
      colName: "Name",
      colEmail: "Email",
      colPhone: "Phone",
      colPlan: "Plan",
      colStatus: "Status",
      clickRow: "Click a row to open the member.",
      empty: "No members yet",
      emptyBody:
        "Members appear here as soon as they sign in with the join link.",
      noMatch: "No members match that search",
      noMatchBody: "Try a shorter search, or clear the filter.",
      emergencyContact: (value: string) => `Emergency contact · ${value}`,
      notGiven: "Not given",
      noPhone: "No phone",
      status: "Status",
      pendingDues: "Pending dues",
      none: "None",
      membershipHistory: "Membership history",
      attendance30: "Attendance · last 30 days",
      last30: "Last 30 days",
      noMemberships: "No memberships yet",
      recordPayment: "Record a cash payment",
      recordPaymentTitle: "Take payment",
      recordPaymentBody:
        "Pick the plan the member is paying for. This records the cash and starts their membership.",
      recordPaymentSubmit: "Mark paid in cash",
      recordPaymentSaving: "Recording",
      recordPaymentDone: (ends: string) => `Membership runs to ${ends}`,
      recordPaymentPickPlan: "Pick a plan first.",
      recordPaymentSaved: "Cash recorded and the membership started.",
      discountHeading: "Discount",
      addDiscount: "Add a discount",
      discountType: "Type",
      discountPercent: "Percent off",
      discountFlat: "Rupees off",
      discountValue: "Amount",
      discountTerm: "Lasts",
      discountTerms: {
        "1m": "1 month",
        "3m": "3 months",
        "6m": "6 months",
        never: "Never expires",
      },
      discountSave: "Save discount",
      discountSaving: "Saving",
      discountRemove: "Remove",
      discountNone: "Paying the list price",
      discountOutOfRange:
        "Percent discounts go up to 40%, and flat discounts from ₹100 to ₹500.",
      discountActive: (label: string, until: string) => `${label} · ${until}`,
      discountUntil: (date: string) => `until ${date}`,
      discountForever: "no expiry",
      extendsFrom: (date: string) => `Starts ${date}, after the current one ends`,
      done: "Done",
      plan: "Plan",
      startMembership: "Start membership",
      addTitle: "Add a member",
      addBody:
        "For someone who joined at the desk and has no phone to scan the code with.",
      addName: "Full name",
      addPhone: "Phone number",
      addEmail: "Email · optional",
      addSubmit: "Add member",
      addSaving: "Adding",
    },

    revenue: {
      title: "Revenue",
      lede: "Cash recorded at the desk. Online payments are not built yet.",
      lifetime: "Collected lifetime",
      thisMonth: "This month",
      lastMonth: "Last month",
      outstanding: "Outstanding",
      paymentsIn: (month: string) => `Payments · ${month}`,
      sortedByDate: "Sorted by date",
      colDate: "Date",
      colMember: "Member",
      colPlan: "Plan",
      colAmount: "Amount",
      colMethod: "Method",
      colStatus: "Status",
      last6: "Last 6 months",
      empty: "No payments recorded yet",
      emptyBody: "Payments taken at the desk show up here.",
      method: {
        cash: "Cash",
        upi: "UPI",
        card: "Card",
        other: "Other",
      },
      status: {
        collected: "Collected",
        pending: "Pending",
        refunded: "Refunded",
      },
    },

    attendance: {
      title: "Attendance",
      checkinsToday: "Check-ins today",
      inGymNow: "In the gym now",
      checkSomeoneIn: "Check someone in",
      searchMember: "Search for a member",
      searchHint: "Type at least two letters",
      markPresent: "Mark present",
      checkingIn: "Checking in",
      alreadyIn: "Already in",
      checkOut: "Check out",
      colMember: "Member",
      colIn: "Checked in",
      colOut: "Checked out",
      colRecordedBy: "Recorded by",
      desk: "Desk",
      stillIn: "Still in",
      empty: "Nobody has checked in today",
      emptyBody: "Search for a member above and check them in.",
      noResults: "No members match that name",
      noResultsBody: "Try a shorter search.",
    },

    alerts: {
      title: "Alerts",
      lede: "Members see these the moment you publish.",
      composeHeading: "New alert",
      titlePlaceholder: "Closing early today",
      bodyPlaceholder: "Shutting at 6pm for maintenance.",
      publish: "Publish to members",
      publishing: "Publishing",
      published: "Published",
      send: "Send",
      sentHeading: "Sent",
      reached: (n: number) =>
        n === 1 ? "1 member reached" : `${n} members reached`,
      empty: "No alerts sent yet",
      emptyBody: "Members see these the moment you publish.",
      needsTitle: "Give the alert a title before publishing it.",
      delete: "Delete",
    },

    settings: {
      title: "Gym settings",
      lede: "Members see opening hours and crowd on the home screen.",
      hoursHeading: "Opening hours",
      openLabel: "Opens",
      closeLabel: "Closes",
      closedLabel: "Closed",
      overrideHeading: "Override",
      overrideNote: "Beats the schedule until cleared",
      blockOutOfOrder: "A time range has to end after it starts.",
      followHours: "Follow hours",
      forceOpen: "Force open",
      forceClosed: "Force closed",
      crowdHeading: "Crowd level",
      crowdFromSchedule: "Following the weekly schedule",
      crowdOverridden: "Set by hand · beats the schedule",
      followCrowdSchedule: "Follow the schedule again",
      hoursSplitNote:
        "A day can have as many ranges as it needs — a morning and an evening session with the gym shut between them is two.",
      addRange: "Add a time range",
      removeRange: "Remove",
      crowdScheduleHeading: "Crowd schedule",
      crowdScheduleNote:
        "What members are told to expect, by day and time. Nothing here is measured — it is the pattern you know.",
      addCrowdSlot: "Add a time range",
      closedAllDay: "Closed all day",
      plansHeading: "Plans",
      newPlan: "New plan",
      editPlan: "Edit plan",
      planName: "Name",
      planNamePlaceholder: "Monthly",
      planPrice: "Price in rupees",
      planDuration: "Length in days",
      planBenefits: "What it includes",
      planBenefitsPlaceholder: "One per line",
      planBenefitsHint:
        "Members see these as a checklist on their membership. Leave it empty and no list is shown.",
      planSave: "Save plan",
      planActive: "Active",
      planInactive: "Inactive",
      activate: "Activate",
      deactivate: "Deactivate",
      staffHeading: "Staff",
      addStaff: "Add staff",
      owner: "Owner",
      staff: "Staff",
      staffCodeNote:
        "Staff codes issued from here let someone claim staff access on the join form.",
      staffCodeLabel: "Staff code",
      joinHeading: "Join link",
      joinNote:
        "Print this or put it on the wall. Members open it with their own camera app.",
      copyLink: "Copy link",
      copied: "Copied",
      save: "Save changes",
      saving: "Saving",
      saved: "Saved",
      revenueSummary: (amount: string) => `${amount} this month`,
      attendanceSummary: (n: number) => `${n} today`,
      alertsSummary: (n: number) => (n === 1 ? "1 sent" : `${n} sent`),
      plansSummary: (n: number) => `${n} active`,
      staffSummary: (n: number) => (n === 1 ? "1 account" : `${n} accounts`),
      hoursSummary: (open: string, close: string) => `${open} – ${close}`,
    },
  },

  /* -------------------------------------------------------------- check-in */

  checkin: {
    title: "Checked in",
    done: "You're in",
    doneBody: "Have a good session.",
    at: (time: string) => `Checked in at ${time}`,
    alreadyTitle: "Already checked in",
    alreadyAt: (time: string) => `You scanned in at ${time}`,
    alreadyBody: "No need to scan again.",
    returning: "Taking you back to the app",
    failedTitle: "Could not check you in",
    failedBody: "Tell the desk and they will record it for you.",
  },

  /* -------------------------------------------------------------- whatsapp */

  whatsapp: {
    feeReminder: (gym: string, amount: string) =>
      `${gym}: your membership fee of ${amount} is still outstanding. You can pay at the desk any time we are open.`,
    invoice: (gym: string, amount: string, plan: string, endsOn: string) =>
      `${gym}: received ${amount} for your ${plan} membership. It runs until ${endsOn}. Thanks.`,
    alert: (gym: string, title: string, body: string) =>
      body.trim().length > 0 ? `${gym}: ${title}\n\n${body}` : `${gym}: ${title}`,

    logHeading: "WhatsApp outbox",
    logNote:
      "No WhatsApp provider is connected yet, so nothing here has actually been sent. These are the messages that would go out.",
    logEmpty: "Nothing queued yet",
    logEmptyBody:
      "Fee reminders, invoices, and published alerts appear here as they are queued.",
    status: {
      queued: "Queued",
      sent: "Sent",
      failed: "Failed",
    },
    type: {
      fee_reminder: "Fee reminder",
      invoice: "Invoice",
      alert: "Alert",
    },
    sendReminder: "Send a fee reminder",
    sendingReminder: "Queueing",
    reminderQueued: "Reminder queued. It will send once WhatsApp is connected.",
    reminderNoPhone: "That member has no phone number on file.",
    alertQueued: (queued: number, skipped: number) =>
      skipped === 0
        ? `Queued for ${queued} members`
        : `Queued for ${queued} members · ${skipped} have no phone number`,
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
    mainNav: "Main",
    dashboardNav: "Dashboard",
    notFoundTitle: "That page does not exist",
    notFoundBody: "Check the link, or go back to the start.",
    goHome: "Go to the start",
    networkErrorTitle: "Couldn't reach the gym's server",
    networkErrorBody: "Check your connection and try again.",
    unexpectedTitle: "That did not load",
    unexpectedBody:
      "The screen failed to load. Try again, and tell the desk if it keeps happening.",
    offline: "You are offline. Showing the last thing we loaded.",
    rupees: (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`,
  },
} as const;

export type Strings = typeof strings;
