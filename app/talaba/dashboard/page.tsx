"use client";

import { useCallback, useState, useEffect, useMemo } from 'react';
import { MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { useThemeStore } from '@/lib/stores/theme-store';
import { getSafeUser } from '@/lib/auth-session';
import { useRoomFloors } from '@/lib/hooks/useRoomFloors';
import ProfileLoadError from '@/components/talaba/ProfileLoadError';
import PageSkeleton from '@/components/ui/PageSkeleton';
import AiAssistant from '@/components/talaba/dashboard/AiAssistant';
import WarningsModal from '@/components/talaba/dashboard/WarningsModal';
import WarningDetailModal from '@/components/talaba/dashboard/WarningDetailModal';
import AnnouncementModal from '@/components/talaba/dashboard/AnnouncementModal';
import CleaningScheduleModal from '@/components/talaba/dashboard/CleaningScheduleModal';
import AdminChatModal from '@/components/talaba/dashboard/AdminChatModal';
import DashboardHeader from '@/components/talaba/dashboard/DashboardHeader';
import RoomAssignmentBanner from '@/components/talaba/dashboard/RoomAssignmentBanner';
import PushNotificationCard from '@/components/pwa/PushNotificationCard';
import RoomInfoCard from '@/components/talaba/dashboard/RoomInfoCard';
import SardorPanelCard from '@/components/talaba/dashboard/SardorPanelCard';
import FloorCaptainCard from '@/components/talaba/dashboard/FloorCaptainCard';
import RoommatesCard from '@/components/talaba/dashboard/RoommatesCard';
import SupportContactsCard from '@/components/talaba/dashboard/SupportContactsCard';
import AnnouncementsBoard from '@/components/talaba/dashboard/AnnouncementsBoard';
import MyApplicationsCard from '@/components/talaba/dashboard/MyApplicationsCard';
import DisciplineRatingCard from '@/components/talaba/dashboard/DisciplineRatingCard';
import PaymentStatusCard from '@/components/talaba/dashboard/PaymentStatusCard';
import TasksCard from '@/components/talaba/dashboard/TasksCard';
import { useCleaningSchedule } from '@/components/talaba/dashboard/useCleaningSchedule';
import { fetchStudentPayments } from '@/features/payments/client/api';
import { fetchStudentProfile } from '@/features/profile/client/api';
import { fetchStudentAnnouncements } from '@/features/announcements/client/api';
import { fetchStudentApplications } from '@/features/applications/client/api';
import { fetchAppSettings } from '@/features/app-settings/client/api';
import { getPaymentStats } from '@/features/app-settings/presentation';
import type {
  SupportContacts,
  Ariza,
  Elon,
  Profile,
  CaptainInfo,
  DashboardPayment,
  MyApplication,
} from '@/components/talaba/dashboard/types';
import { formatElonDate } from '@/components/talaba/dashboard/helpers';

export default function TalabaDashboard() {
  const { floorOf } = useRoomFloors();

  // State - Profile va Roommates
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roommates, setRoommates] = useState<Profile[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [floorCaptain, setFloorCaptain] = useState<CaptainInfo | null>(null);
  // Xona biriktirilgani haqidagi bannerni talaba yopgani — xona raqami bilan
  // birga saqlanadi, shunda keyinchalik xona almashtirilsa banner qayta chiqadi.
  const [seenRoomAssignment, setSeenRoomAssignment] = useState<string | null>(null);


  // State - UI
  const [showArizalar, setShowArizalar] = useState(false);
  const [selectedElon, setSelectedElon] = useState<Elon | null>(null);
  const [selectedAriza, setSelectedAriza] = useState<Ariza | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [elonCategory, setElonCategory] = useState<string>("Barchasi");

  // State - Theme
  const theme = useThemeStore((state) => state.theme);
  const isLight = theme === 'light';

  // State - Dynamic Data
  const [elonlar, setElonlar] = useState<Elon[]>([]);
  const [arizalar, setArizalar] = useState<Ariza[]>([]);
  const [payments, setPayments] = useState<DashboardPayment[]>([]);
  const [myApplications, setMyApplications] = useState<MyApplication[]>([]);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [contacts, setContacts] = useState<SupportContacts | null>(null);
  const [yearlyContractFee, setYearlyContractFee] = useState<number | null>(null);
  const [settingsStatus, setSettingsStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const allResidents = useMemo(() => {
    if (!profile) return [];
    const list = [
      { id: profile.id, name: `${profile.full_name} (Siz)`, isSelf: true }
    ];
    roommates.forEach(r => {
      list.push({ id: r.id, name: r.full_name, isSelf: false });
    });
    return list;
  }, [profile, roommates]);

  // All cleaning-duty schedule state + logic (see useCleaningSchedule).
  const cleaning = useCleaningSchedule(profile, allResidents);

  const loadSettings = useCallback(async () => {
    setSettingsStatus('loading');
    try {
      const settings = await fetchAppSettings();
      setContacts({
        tarbiyachiName: settings.tarbiyachiName, tarbiyachiPhone: settings.tarbiyachiPhone,
        komendantName: settings.komendantName, komendantPhone: settings.komendantPhone,
        doctorName: settings.doctorName, doctorPhone: settings.doctorPhone,
        talabaKengashiRaisiOgilName: settings.talabaKengashiRaisiOgilName, talabaKengashiRaisiOgilPhone: settings.talabaKengashiRaisiOgilPhone,
        talabaKengashiRaisiQizName: settings.talabaKengashiRaisiQizName, talabaKengashiRaisiQizPhone: settings.talabaKengashiRaisiQizPhone,
      });
      setYearlyContractFee(settings.yearlyContractFee);
      setSettingsStatus('ready');
    } catch {
      setContacts(null);
      setYearlyContractFee(null);
      setSettingsStatus('error');
      toast.error("To'lov va aloqa sozlamalarini yuklab bo'lmadi");
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // Lock body scroll when any modal is open
  useEffect(() => {
    const isAnyModalOpen = cleaning.isModalOpen || !!selectedElon || !!selectedAriza || showArizalar || isChatModalOpen;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [cleaning.isModalOpen, selectedElon, selectedAriza, showArizalar, isChatModalOpen]);

  // Fetch Profile, Roommates, Announcements, and Disciplinary Writeups
  useEffect(() => {
    async function fetchData() {
      try {
        setLoadingProfile(true);
        const user = await getSafeUser();

        let currentProfile: Profile | null = null;

        if (user) {
          // 1. Profil ma'lumotlarini olish
          const profilePayload = await fetchStudentProfile();
          const profileData = profilePayload.profile;
          const profileError = !profileData;

          if (!profileError && profileData) {
            currentProfile = profileData as Profile;
            setProfile(currentProfile);

            setRoommates((profilePayload.roommates ?? []) as Profile[]);

            // 2b. Qavat sardorini yuklash
            if (profilePayload.floorCaptain) {
              setFloorCaptain({
                full_name: profilePayload.floorCaptain.full_name ?? '',
                phone_number: profilePayload.floorCaptain.phone_number ?? undefined,
                email: profilePayload.floorCaptain.email ?? undefined,
              });
            }
          }
        }

        if (!currentProfile) {
          setProfileError(true);
        }

        // Steps 3-5 load supplementary data (announcements, warnings, payments).
        // A failure here must never hide an already-loaded profile behind the
        // fatal error screen, so each step is isolated in its own try/catch.

        // 3. Real E'lonlarni Yuklash (API orqali filterlangan holda)
        try {
          const resultElon = await fetchStudentAnnouncements();

          if (Array.isArray(resultElon.elonlar)) {
            const mappedElons = resultElon.elonlar.map((e) => ({
              id: e.id,
              title: e.title,
              type: e.type,
              teacher: e.author_name || "Tizim ma'muri",
              room: e.is_from_captain ? `${e.captain_floor}-qavat sardori` : "Ma'muriyat",
              time: formatElonDate(e.published_at ?? e.created_at),
              desc: e.text,
              is_from_captain: e.is_from_captain,
            }));
            setElonlar(mappedElons);
          } else {
            setElonlar([]);
          }
        } catch (elonError) {
          console.error("E'lonlarni yuklashda xato:", elonError);
          setElonlar([]);
        }

        // 4. Real Arizalar / Ogohlantirishlarni Yuklash (arizalar table)
        try {
          if (currentProfile && currentProfile.full_name) {
            const { applications: arizalarData } = await fetchStudentApplications('warnings');

            if (arizalarData && arizalarData.length > 0) {
              const mappedArizalar = arizalarData.map((a) => ({
                id: a.id,
                ism: a.student_name ?? currentProfile.full_name,
                kurs: currentProfile?.course ? `${currentProfile.course}-kurs` : "—",
                yonalish: currentProfile?.faculty || "—",
                sana: a.created_at ? new Date(a.created_at).toLocaleDateString('uz-UZ') : '—',
                matn: a.text,
                daraja: (a.level === 'critical' ? 'danger' : a.level === 'warning' ? 'warning' : 'info') as Ariza['daraja'],
              }));
              setArizalar(mappedArizalar);
            } else {
              setArizalar([]);
            }
          }
        } catch (arizaError) {
          console.error('Arizalarni yuklashda xato:', arizaError);
          setArizalar([]);
        }

        // 4b. Real Murojaat va Arizalarim Statusini Yuklash (arizalar table)
        try {
          if (user) {
            const { applications: myAppsData } = await fetchStudentApplications('documents', 3);

            if (myAppsData && myAppsData.length > 0) {
              const mappedMyApps = myAppsData.map((app) => ({
                id: app.id,
                type: (app.type || 'ariza') as 'ariza' | 'tushuntirish',
                title: app.title || 'Sarlavhasiz',
                createdDate: app.date || app.created_at || new Date().toISOString(),
                status: (app.status || 'pending') as 'draft' | 'submitted' | 'pending' | 'approved' | 'rejected',
              }));
              setMyApplications(mappedMyApps);
            } else {
              setMyApplications([]);
            }
          } else {
            setMyApplications([]);
          }
        } catch (myAppsCatchError) {
          console.error('Murojaatlarni yuklashda xato:', myAppsCatchError);
          setMyApplications([]);
        }

        // 5. Real Tolovlarni Yuklash (tolovlar table)
        try {
          if (user) {
            setPayments(await fetchStudentPayments());
          }
        } catch (tolovCatchError) {
          console.error("To'lovlarni yuklashda xato:", tolovCatchError);
        }

      } catch (error) {
        console.error('Ma\'lumotlarni yuklashda xato:', error);
        setProfileError(true);
      } finally {
        setLoadingProfile(false);
      }
    }

    fetchData();
  }, []);

  // Active warnings: users.warning_count can lag the actual list, so take the larger.
  const arizaSoni = typeof profile?.warning_count === 'number' ? Math.max(profile.warning_count, arizalar.length) : arizalar.length;

  const roomNumberFull = profile?.room_number || '—';
  const floor = floorOf(profile?.room_number);
  const fullName = profile?.full_name || 'Talaba';
  const faculty = profile?.faculty || 'Fakultet';
  const course = Number(profile?.course ?? 1);
  const group = profile?.group || '—';

  // Search + category filter over announcements
  const filteredElonlar = useMemo(() => {
    return elonlar.filter(e => {
      const matchesSearch = e.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                            e.desc.toLowerCase().includes(searchQuery.trim().toLowerCase());
      const matchesTab = elonCategory === "Barchasi" || e.type === elonCategory;
      return matchesSearch && matchesTab;
    });
  }, [elonlar, searchQuery, elonCategory]);

  useEffect(() => {
    setSeenRoomAssignment(localStorage.getItem('seen_room_assignment'));
  }, []);

  const dismissRoomBanner = useCallback(() => {
    const room = profile?.room_number;
    if (!room) return;
    localStorage.setItem('seen_room_assignment', room);
    setSeenRoomAssignment(room);
  }, [profile?.room_number]);

  const paidAmount = payments
    .filter(p => p.status === 'paid' || p.status === 'approved')
    .reduce((sum, p) => sum + p.amount, 0);
  const paymentStats = getPaymentStats(yearlyContractFee, paidAmount);

  if (loadingProfile) {
    return (
      <div className={`min-h-screen px-4 py-6 ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100' : 'bg-[#02040a]'}`}>
        <PageSkeleton />
      </div>
    );
  }

  if (profileError || !profile) {
    return <ProfileLoadError isLight={isLight} />;
  }

  return (
    <div className="relative w-full max-w-6xl mx-auto p-2 sm:p-4 md:p-6 space-y-6 sm:space-y-8 min-h-screen transition-colors duration-300">
      
      <DashboardHeader
        isLight={isLight}
        faculty={faculty}
        group={group}
        fullName={fullName}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <RoomAssignmentBanner
        isLight={isLight}
        roomNumber={profile.room_number}
        floor={floor}
        seenRoomAssignment={seenRoomAssignment}
        onDismiss={dismissRoomBanner}
      />

      <PushNotificationCard isLight={isLight} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* ================= LEFT COLUMN ================= */}
        <div className="lg:col-span-4 space-y-6 sm:space-y-8">
          <RoomInfoCard
            roomNumberFull={roomNumberFull}
            floor={floor}
            course={course}
            group={group}
            todayName={cleaning.todayName}
            todayDutyPerson={cleaning.todayDutyPerson}
            selfId={profile.id}
            selfName={profile.full_name}
            onOpenSchedule={cleaning.openModal}
          />

          {profile.is_floor_captain && (
            <SardorPanelCard isLight={isLight} assignedFloor={profile.assigned_floor} />
          )}

          {floorCaptain && (
            <FloorCaptainCard isLight={isLight} captain={floorCaptain} floor={floor} />
          )}

          <RoommatesCard isLight={isLight} roommates={roommates} />

          <SupportContactsCard
            isLight={isLight}
            contacts={contacts}
            settingsStatus={settingsStatus}
            onRetry={() => void loadSettings()}
          />
        </div>

        {/* ================= RIGHT COLUMN ================= */}
        <div className="lg:col-span-8 space-y-6 sm:space-y-8">
          {/* "Xabarlar" is the one action not already in the bottom nav bar. */}
          <button
            onClick={() => setIsChatModalOpen(true)}
            className="w-full flex items-center gap-4 rounded-[32px] p-6 bg-blue-600 text-white text-left transition-all"
          >
            <div className="shrink-0 flex items-center justify-center size-14 rounded-2xl bg-white/15">
              <MessageSquare className="size-7" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black uppercase tracking-wider">Xabarlar</h3>
              <p className="text-xs text-white/80 mt-0.5">Yotoqxona ma&apos;muriyati bilan yozishmalar</p>
            </div>
          </button>

          <AnnouncementsBoard
            isLight={isLight}
            items={filteredElonlar}
            category={elonCategory}
            onCategoryChange={setElonCategory}
            onSelect={setSelectedElon}
          />

          <MyApplicationsCard isLight={isLight} items={myApplications} />

          <DisciplineRatingCard
            isLight={isLight}
            warningCount={arizaSoni}
            onShowWarnings={() => setShowArizalar(true)}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            <PaymentStatusCard
              isLight={isLight}
              paidAmount={paidAmount}
              stats={paymentStats}
              settingsStatus={settingsStatus}
              onRetry={() => void loadSettings()}
            />
            <TasksCard isLight={isLight} />
          </div>
        </div>
      </div>

      <WarningsModal
        open={showArizalar}
        onClose={() => setShowArizalar(false)}
        items={arizalar}
        onSelect={setSelectedAriza}
      />
      <WarningDetailModal ariza={selectedAriza} onClose={() => setSelectedAriza(null)} />
      <AnnouncementModal elon={selectedElon} onClose={() => setSelectedElon(null)} />

      {/* Floating AI assistant (self-contained: own state + /api/ai/chat) */}
      <AiAssistant isLight={isLight} />

      {/* Weekly cleaning-duty schedule editor */}
      <CleaningScheduleModal
        isLight={isLight}
        roomNumber={profile?.room_number ?? null}
        {...cleaning.modal}
      />

      {/* Admin <-> student chat (self-contained: own polling + state) */}
      <AdminChatModal
        open={isChatModalOpen}
        onClose={() => setIsChatModalOpen(false)}
        isLight={isLight}
        profile={profile}
      />

    </div>
  );
}
