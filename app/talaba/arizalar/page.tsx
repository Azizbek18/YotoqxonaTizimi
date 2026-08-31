'use client'

import dynamic from 'next/dynamic'
import { Loader } from '@/components/ui/Loader'

const ArizalarContent = dynamic(() => import('./ArizalarContent'), {
    ssr: false,
    loading: () => (
        <div className="flex h-[60vh] items-center justify-center">
            <Loader size={96} />
        </div>
    )
})

export default function Page() {
    return <ArizalarContent />
}
