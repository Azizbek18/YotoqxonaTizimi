/** One faculty's fee pair, for the superadmin cross-faculty fee table. */
export type FacultyFee = {
  faculty: string
  facultyLabel: string
  monthlyFee: number
  yearlyContractFee: number
  /** true = this faculty has its own app_settings row; false = the row is
   *  the primary building's / the built-in default, shown until it's set. */
  configured: boolean
}

export type AppSettings = {
  monthlyFee: number
  yearlyContractFee: number
  defaultRoomCapacity: number
  floorCount: number
  tarbiyachiName: string
  tarbiyachiPhone: string
  komendantName: string
  komendantPhone: string
  doctorName: string
  doctorPhone: string
  talabaKengashiRaisiOgilName: string
  talabaKengashiRaisiOgilPhone: string
  talabaKengashiRaisiQizName: string
  talabaKengashiRaisiQizPhone: string
  securityPhone: string
  maxUploadSizeMb: number
  warningThreshold: number
  /** Official dormitory (TTJ) number/name — fills the "___-sonli talabalar
   *  turar joyi" blank in the imtiyozli Ariza/Tilxat documents. */
  ttjName: string
}
