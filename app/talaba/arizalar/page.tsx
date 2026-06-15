'use client'

import dynamic from 'next/dynamic'

const ArizalarContent = dynamic(() => import('./ArizalarContent'), {
    ssr: false,
    loading: () => (
        <div className="flex h-[60vh] items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400"></div>
        </div>
    )
})

export default function Page() {
    return <ArizalarContent />
}
