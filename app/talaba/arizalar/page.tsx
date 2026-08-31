'use client'

import dynamic from 'next/dynamic'
import PageSkeleton from '@/components/ui/PageSkeleton'

const ArizalarContent = dynamic(() => import('./ArizalarContent'), {
    ssr: false,
    loading: () => <PageSkeleton />,
})

export default function Page() {
    return <ArizalarContent />
}
