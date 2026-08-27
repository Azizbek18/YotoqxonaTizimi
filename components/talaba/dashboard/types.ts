import type { AppSettings } from '@/features/app-settings/types';

export interface Task {
  id: number;
  text: string;
  completed: boolean;
}

export type SupportContacts = Pick<
  AppSettings,
  | 'tarbiyachiName'
  | 'tarbiyachiPhone'
  | 'komendantName'
  | 'komendantPhone'
  | 'doctorName'
  | 'doctorPhone'
  | 'talabaKengashiRaisiOgilName'
  | 'talabaKengashiRaisiOgilPhone'
  | 'talabaKengashiRaisiQizName'
  | 'talabaKengashiRaisiQizPhone'
>;

/** A disciplinary write-up shown to the student ("Ogohlantirish"). */
export interface Ariza {
  id: string | number;
  ism: string;
  kurs: string;
  yonalish: string;
  sana: string;
  matn: string;
  daraja: 'warning' | 'danger' | 'info';
}

/** An announcement row, already mapped to the dashboard's view shape. */
export interface Elon {
  id: string | number;
  title: string;
  type: 'Muhim' | 'Tadbir' | 'Yangilik' | 'Ogohlantirish';
  teacher: string;
  room: string;
  time: string;
  desc: string;
  is_from_captain?: boolean;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  phone_number?: string;
  faculty?: string;
  role?: string;
  room_number?: string;
  course?: string | number;
  group?: string | number;
  avatar_url?: string;
  is_floor_captain?: boolean;
  assigned_floor?: number;
  gender?: string;
  warning_count?: number;
}

export interface CaptainInfo {
  full_name: string;
  phone_number?: string;
  email?: string;
}

export interface DashboardPayment {
  id?: string | number;
  month?: string;
  year?: number;
  amount: number;
  status: string;
  created_at?: string;
}

export interface MyApplication {
  id: string | number;
  type: 'ariza' | 'tushuntirish';
  title: string;
  createdDate: string;
  status: 'draft' | 'submitted' | 'pending' | 'approved' | 'rejected';
}

export type AdminChatMessage = {
  id?: string | number;
  title?: string;
  text?: string;
  reason?: string;
  status?: string;
  created_at?: string;
  date?: string;
  sender_role?: string;
};

/** One cleaning-duty slot: a room resident, or empty. */
export type CleaningAssignee = { id: string; name: string };
export type CleaningScheduleMap = Record<string, CleaningAssignee | null>;

/** A room resident as offered in the schedule editor ("... (Siz)" for self). */
export type Resident = { id: string; name: string; isSelf: boolean };
