'use client'

import dynamic from 'next/dynamic'
import { TalabaArizalarSkeleton } from '@/components/talaba/skeletons'

const ArizalarContent = dynamic(() => import('./ArizalarContent'), {
    ssr: false,
    loading: () => <TalabaArizalarSkeleton />,
})

export default function Page() {
    return <ArizalarContent />
}
