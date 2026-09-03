'use client'

import type { ReactNode } from 'react'
import type { RegisterData } from './types'
import Step1Passport from './Step1Passport'
import Step2Name from './Step2Name'
import Step3Gender from './Step3Gender'
import Step5Address from './Step5Address'
import Step6Family from './Step6Family'
import Step7Date from './Step7Date'
import Step8Room from './Step8Room'
import Step9Password from './Step9Password'

export type StepId =
  | 'passport' | 'identity' | 'personal' | 'address'
  | 'family' | 'entry' | 'room' | 'password'

export type ApplicationType = 'yollanma' | 'imtiyozli'

// One props bag threaded to every step. Steps read what they need; the password
// step is the only one that uses the password / submit fields.
export interface WizardStepProps {
  data: RegisterData
  onChange: (partial: Partial<RegisterData>) => void
  onNext: () => void
  onBack: () => void
  stepNumber: number
  totalSteps: number
  applicationType: ApplicationType
  password: string
  confirmPassword: string
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onSubmit: () => void
  loading: boolean
}

interface StepDescriptor {
  id: StepId
  includeFor: (ctx: { applicationType: ApplicationType }) => boolean
  render: (p: WizardStepProps) => ReactNode
}

// Order is the wizard order. `address` is O'zbekiston-fuqarosi-only — an
// imtiyozli (foreign) applicant's country/region come from the permit.
const ALL_STEPS: StepDescriptor[] = [
  {
    id: 'passport',
    includeFor: () => true,
    render: (p) => (
      <Step1Passport
        data={p.data} onChange={p.onChange} onNext={p.onNext}
        stepNumber={p.stepNumber} totalSteps={p.totalSteps}
        requiresJshshir={p.applicationType === 'yollanma'}
      />
    ),
  },
  {
    id: 'identity',
    includeFor: () => true,
    render: (p) => (
      <Step2Name
        data={p.data} onChange={p.onChange} onNext={p.onNext} onBack={p.onBack}
        stepNumber={p.stepNumber} totalSteps={p.totalSteps}
      />
    ),
  },
  {
    id: 'personal',
    includeFor: () => true,
    render: (p) => (
      <Step3Gender
        data={p.data} onChange={p.onChange} onNext={p.onNext} onBack={p.onBack}
        stepNumber={p.stepNumber} totalSteps={p.totalSteps}
      />
    ),
  },
  {
    id: 'address',
    includeFor: ({ applicationType }) => applicationType === 'yollanma',
    render: (p) => (
      <Step5Address
        data={p.data} onChange={p.onChange} onNext={p.onNext} onBack={p.onBack}
        stepNumber={p.stepNumber} totalSteps={p.totalSteps}
      />
    ),
  },
  {
    id: 'family',
    includeFor: () => true,
    render: (p) => (
      <Step6Family
        data={p.data} onChange={p.onChange} onNext={p.onNext} onBack={p.onBack}
        stepNumber={p.stepNumber} totalSteps={p.totalSteps}
      />
    ),
  },
  {
    id: 'entry',
    includeFor: () => true,
    render: (p) => (
      <Step7Date
        data={p.data} onChange={p.onChange} onNext={p.onNext} onBack={p.onBack}
        stepNumber={p.stepNumber} totalSteps={p.totalSteps}
      />
    ),
  },
  {
    id: 'room',
    includeFor: () => true,
    render: (p) => (
      <Step8Room
        data={p.data} onNext={p.onNext} onBack={p.onBack}
        stepNumber={p.stepNumber} totalSteps={p.totalSteps}
        applicationType={p.applicationType}
      />
    ),
  },
  {
    id: 'password',
    includeFor: () => true,
    render: (p) => (
      <Step9Password
        data={p.data} onBack={p.onBack}
        stepNumber={p.stepNumber} totalSteps={p.totalSteps}
        password={p.password} confirmPassword={p.confirmPassword}
        onPasswordChange={p.onPasswordChange}
        onConfirmPasswordChange={p.onConfirmPasswordChange}
        onSubmit={p.onSubmit} loading={p.loading}
      />
    ),
  },
]

export function buildSteps(applicationType: ApplicationType): StepDescriptor[] {
  return ALL_STEPS.filter((s) => s.includeFor({ applicationType }))
}

export type { StepDescriptor }
