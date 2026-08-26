// The generated schema is the single source of truth for row shapes. Everything
// else in this package is a narrowing of it, so a column rename shows up as a
// type error rather than as a runtime undefined.
export type { Database, Json } from './database';

import type { Database } from './database';

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];
export type Views<T extends keyof PublicSchema['Views']> =
  PublicSchema['Views'][T]['Row'];
export type Functions<T extends keyof PublicSchema['Functions']> =
  PublicSchema['Functions'][T];

export type Gym = Tables<'gyms'>;
export type Profile = Tables<'profiles'>;
export type GymMember = Tables<'gym_members'>;
export type GymStaff = Tables<'gym_staff'>;
export type MembershipPlan = Tables<'membership_plans'>;
export type Membership = Tables<'memberships'>;
export type Payment = Tables<'payments'>;
export type GymHours = Tables<'gym_hours'>;
export type Broadcast = Tables<'broadcasts'>;
export type Notification = Tables<'notifications'>;
export type Issue = Tables<'issues'>;
export type IssueMessage = Tables<'issue_messages'>;
export type CurrentMembership = Views<'v_current_memberships'>;
