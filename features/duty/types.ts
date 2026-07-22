export type CleaningAssignee = { id: string; name: string }
export type CleaningSchedule = Record<string, CleaningAssignee | null>
