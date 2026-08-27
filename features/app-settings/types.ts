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
