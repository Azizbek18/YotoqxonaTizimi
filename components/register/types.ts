export interface RegisterData {
  // Step 1
  passportSeries: string
  jshshir: string
  passportPlace: string
  passportDate: string
  // Step 2
  lastName: string
  firstName: string
  middleName: string
  birthDate: string
  phone: string
  // Step 3
  gender: 'male' | 'female' | '',
  nationality: string
  // Step 4
  faculty: string
  direction: string
  course: string
  study_type: string,
  // Step 5
  region: string
  district: string
  mahalla: string
  street: string
  houseNumber: string
  // Step 6
  father_full_name: string;
  father_workplace: string;
  father_phone: string;
  mother_full_name: string;
  mother_workplace: string;
  mother_phone: string;
  // Step 7
  entryDate: string
  // Step 8
  room_number: string
  //Step 9
  email: string
  password: string
  confirmPassword: string
}

export const initialData: RegisterData = {
  passportSeries: '',
  jshshir: '',
  passportPlace: '',
  passportDate: '',
  lastName: '',
  firstName: '',
  middleName: '',
  birthDate: '',
  phone: '',
  gender: '',
  nationality: '',
  faculty: 'amit',
  direction: '',
  course: '1',
  study_type: '',
  region: '',
  district: '',
  mahalla: '',
  street: '',
  houseNumber: '',
  father_full_name: '',
  father_workplace: '',
  father_phone : '',
  mother_full_name: '',
  mother_workplace : '',
  mother_phone : '',
  entryDate: '',
  password: '',
  room_number: '',
  email: '',
  confirmPassword: '',
}