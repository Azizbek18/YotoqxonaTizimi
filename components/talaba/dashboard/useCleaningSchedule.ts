'use client';

import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import toast from 'react-hot-toast';
import { fetchCleaningSchedule, saveCleaningSchedule } from '@/features/duty/client/cleaning-api';
import type { CleaningScheduleMap, Profile, Resident } from './types';

export const WEEKDAYS = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
const DAY_BY_GETDAY = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

/** Sequential fallback: residents cycled across the week (Mon..Sun). */
function buildDefaultSchedule(residents: Resident[]): CleaningScheduleMap {
  const result: CleaningScheduleMap = {};
  WEEKDAYS.forEach((day, idx) => {
    const resident = residents.length > 0 ? residents[idx % residents.length] : null;
    result[day] = resident ? { id: resident.id, name: resident.name } : null;
  });
  return result;
}

/**
 * All state and logic for the room's cleaning-duty schedule: the confirmed
 * schedule, the modal's editable draft, drag-and-drop / click-to-assign, and
 * server persistence. The server (keyed by room_number) is the single source
 * of truth — it's shared by every roommate.
 *
 * Call this once in the page and thread its output to both the room card
 * (todayName / todayDutyPerson / openModal) and <CleaningScheduleModal/>.
 */
export function useCleaningSchedule(profile: Profile | null, allResidents: Resident[]) {
  const [cleaningSchedule, setCleaningSchedule] = useState<CleaningScheduleMap>({});
  const [draftSchedule, setDraftSchedule] = useState<CleaningScheduleMap>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [activeDragOverDay, setActiveDragOverDay] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const todayName = useMemo(() => DAY_BY_GETDAY[new Date().getDay()], []);
  const todayDutyPerson = cleaningSchedule[todayName] || null;

  // Load from the server; fall back to a sequential default when nothing is
  // saved yet or the request fails.
  useEffect(() => {
    if (!profile || !profile.room_number || allResidents.length === 0) return;

    async function loadSchedule() {
      try {
        const { schedule } = await fetchCleaningSchedule();
        if (schedule) {
          setCleaningSchedule(schedule);
          return;
        }
      } catch (error) {
        console.error('Navbatchilik jadvalini yuklashda xato:', error);
      }
      setCleaningSchedule(buildDefaultSchedule(allResidents));
    }

    loadSchedule();
  }, [profile, allResidents]);

  // Reset the draft to the confirmed schedule each time the modal opens.
  useEffect(() => {
    if (isModalOpen) {
      setDraftSchedule({ ...cleaningSchedule });
      setSelectedResidentId(null);
      setActiveDragOverDay(null);
    }
  }, [isModalOpen, cleaningSchedule]);

  const assignDay = useCallback((day: string, residentId: string) => {
    const resident = allResidents.find((r) => r.id === residentId);
    if (!resident) return;
    setDraftSchedule((prev) => ({ ...prev, [day]: { id: resident.id, name: resident.name } }));
  }, [allResidents]);

  const onDragStart = useCallback((e: DragEvent, residentId: string) => {
    e.dataTransfer.setData('text/plain', residentId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
  }, []);

  const onDragEnter = useCallback((e: DragEvent, day: string) => {
    e.preventDefault();
    setActiveDragOverDay(day);
  }, []);

  const onDragLeave = useCallback((e: DragEvent, day: string) => {
    e.preventDefault();
    setActiveDragOverDay((current) => (current === day ? null : current));
  }, []);

  const onDrop = useCallback((e: DragEvent, day: string) => {
    e.preventDefault();
    setActiveDragOverDay(null);
    assignDay(day, e.dataTransfer.getData('text/plain'));
  }, [assignDay]);

  const onResidentClick = useCallback((residentId: string) => {
    setSelectedResidentId((current) => (current === residentId ? null : residentId));
  }, []);

  const onDayClick = useCallback((day: string) => {
    if (!selectedResidentId) return;
    assignDay(day, selectedResidentId);
    setSelectedResidentId(null);
  }, [selectedResidentId, assignDay]);

  /** CustomSelect: an id assigns, '' clears the slot. */
  const onSetSlot = useCallback((day: string, residentId: string) => {
    if (residentId) {
      assignDay(day, residentId);
      return;
    }
    setDraftSchedule((prev) => {
      const next = { ...prev };
      delete next[day];
      return next;
    });
  }, [assignDay]);

  const onReset = useCallback(() => {
    setDraftSchedule(buildDefaultSchedule(allResidents));
    toast.success('Jadval standart holatga qaytarildi');
  }, [allResidents]);

  // Persist server-side (shared by the whole room). On failure the modal
  // stays open so the edit isn't silently lost.
  const onSave = useCallback(async () => {
    if (!profile || !profile.room_number) return;
    setIsSaving(true);
    try {
      const { schedule } = await saveCleaningSchedule(draftSchedule);
      setCleaningSchedule(schedule);
      toast.success('Navbatchilik jadvali muvaffaqiyatli saqlandi!');
      setIsModalOpen(false);
    } catch (err) {
      console.error('Navbatchilik jadvalini saqlashda xato:', err);
      toast.error(err instanceof Error ? err.message : "Jadvalni saqlab bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setIsSaving(false);
    }
  }, [profile, draftSchedule]);

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  return {
    todayName,
    todayDutyPerson,
    isModalOpen,
    openModal,
    /** Everything <CleaningScheduleModal/> needs, minus isLight / roomNumber. */
    modal: {
      open: isModalOpen,
      weekdays: WEEKDAYS,
      residents: allResidents,
      draftSchedule,
      activeDragOverDay,
      selectedResidentId,
      isSaving,
      onClose: closeModal,
      onDayClick,
      onDragStart,
      onDragOver,
      onDragEnter,
      onDragLeave,
      onDrop,
      onResidentClick,
      onSetSlot,
      onReset,
      onSave,
    },
  };
}
