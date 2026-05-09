import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Anon client - faqat public operations
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// GET - foydalanuvchining avatar URLsini olish
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const userId = searchParams.get('userId')

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID topilmadi' },
                { status: 400 }
            )
        }

        const { data, error } = await supabase
            .from('users')
            .select('avatar_url')
            .eq('id', userId)
            .single()

        if (error) {
            return NextResponse.json(
                { error: 'Foydalanuvchi topilmadi' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            avatar_url: data.avatar_url
        })
    } catch (error) {
        console.error('GET xatosi:', error)
        return NextResponse.json(
            { error: 'Server xatosi' },
            { status: 500 }
        )
    }
}

// POST - yangi avatar yuklash
export async function POST(request: NextRequest) {
    try {
        console.log('🔵 Avatar upload request started')

        // Auth header'dan token'ni olish
        const authHeader = request.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            console.log('❌ Missing or invalid auth header')
            return NextResponse.json(
                { error: 'Avtentifikatsiya talab qilinadi' },
                { status: 401 }
            )
        }

        const token = authHeader.substring(7)

        // Supabase anon client'da session'ni set qilish
        const supabaseAuth = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        )

        // Token'dan user'ni olish
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)

        if (authError || !user) {
            console.log('❌ Auth error:', authError)
            return NextResponse.json(
                { error: 'Avtentifikatsiya xatosi' },
                { status: 401 }
            )
        }

        console.log('✅ User authenticated:', user.id)

        const formData = await request.formData()
        const file = formData.get('file') as File
        const userId = formData.get('userId') as string

        console.log('📦 FormData:', { file: file?.name, userId, fileSize: file?.size, fileType: file?.type })

        // User ID'ni verify qilish - faqat o'z avatarini upload qila oladi
        if (userId !== user.id) {
            console.log('❌ User ID mismatch')
            return NextResponse.json(
                { error: 'Ruxsatnoma berilmadi' },
                { status: 403 }
            )
        }

        if (!file) {
            console.log('❌ Missing file')
            return NextResponse.json(
                { error: 'Fayl topilmadi' },
                { status: 400 }
            )
        }

        // File tipini tekshirish
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        if (!validTypes.includes(file.type)) {
            console.log('❌ Invalid file type:', file.type)
            return NextResponse.json(
                { error: 'Faqat JPEG, PNG, WebP yoki GIF formatida rasm qabul qilinadi' },
                { status: 400 }
            )
        }

        // File hajmini tekshirish (5MB)
        const maxSize = 5 * 1024 * 1024
        if (file.size > maxSize) {
            console.log('❌ File too large:', file.size, 'bytes')
            return NextResponse.json(
                { error: `Rasm ${maxSize / 1024 / 1024}MB dan katta bo'lmasligi kerak` },
                { status: 400 }
            )
        }

        // Eski avatarni o'chirish
        const { data: userData } = await supabase
            .from('users')
            .select('avatar_url')
            .eq('id', userId)
            .single()

        if (userData?.avatar_url) {
            try {
                const oldPath = userData.avatar_url.split('/avatar/')[1]
                if (oldPath) {
                    await supabase.storage.from('avatar').remove([oldPath])
                }
            } catch (e) {
                console.warn('Eski fayl o\'chirilishida xato:', e)
            }
        }

        const buffer = await file.arrayBuffer()
        const timestamp = Date.now()
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const filename = `${userId}/${timestamp}.${fileExtension}`

        console.log('📤 Uploading to Storage:', { filename, size: buffer.byteLength })

        // Supabase Storage-ga yuklash (avatar bucket)
        const { data, error } = await supabase
            .storage
            .from('avatar')
            .upload(filename, Buffer.from(buffer), {
                cacheControl: '3600',
                upsert: true,
                contentType: file.type,
            })

        if (error) {
            console.error('❌ Storage error:', error)
            return NextResponse.json(
                { error: `Rasm yuklanishida xato: ${error.message}` },
                { status: 500 }
            )
        }

        console.log('✅ File uploaded:', data.path)

        // Public URL olish
        const { data: publicData } = supabase
            .storage
            .from('avatar')
            .getPublicUrl(data.path)

        const publicUrl = publicData.publicUrl
        console.log('🔗 Public URL:', publicUrl)

        // Users jadvalida avatar_url ni update qilish
        const { data: updateData, error: updateError } = await supabase
            .from('users')
            .update({ avatar_url: publicUrl })
            .eq('id', userId)
            .select()

        if (updateError) {
            console.error('Profile update xatosi:', updateError)
            // Storage-dan fayl o'chirish agarda profile update bo'lmasa
            await supabase.storage.from('avatar').remove([data.path])

            return NextResponse.json(
                { error: `Profil yangilashida xato: ${updateError.message}` },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            url: publicUrl,
            data: updateData,
            message: 'Rasm muvaffaqiyatli yuklanildi'
        })

    } catch (error) {
        console.error('🔴 Upload caught error:', error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        return NextResponse.json(
            { error: `Server xatosi: ${errorMessage}` },
            { status: 500 }
        )
    }
}

// DELETE - avatarni o'chirish
export async function DELETE(request: NextRequest) {
    try {
        // Auth header'dan token'ni olish
        const authHeader = request.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Avtentifikatsiya talab qilinadi' },
                { status: 401 }
            )
        }

        const token = authHeader.substring(7)

        // Supabase anon client'da user'ni olish
        const supabaseAuth = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        )

        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Avtentifikatsiya xatosi' },
                { status: 401 }
            )
        }

        const searchParams = request.nextUrl.searchParams
        const userId = searchParams.get('userId')

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID topilmadi' },
                { status: 400 }
            )
        }

        // User ID'ni verify qilish
        if (userId !== user.id) {
            return NextResponse.json(
                { error: 'Ruxsatnoma berilmadi' },
                { status: 403 }
            )
        }

        // Foydalanuvchining avatarini olish
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('avatar_url')
            .eq('id', userId)
            .single()

        if (userError || !userData?.avatar_url) {
            return NextResponse.json(
                { error: 'Avatar topilmadi' },
                { status: 404 }
            )
        }

        // Storage-dan fayl o'chirish
        try {
            const oldPath = userData.avatar_url.split('/avatar/')[1]
            if (oldPath) {
                await supabase.storage.from('avatar').remove([oldPath])
            }
        } catch (e) {
            console.warn('Fayl o\'chirilishida xato:', e)
        }

        // avatar_url-ni null qilish
        const { error: updateError } = await supabase
            .from('users')
            .update({ avatar_url: null })
            .eq('id', userId)

        if (updateError) {
            return NextResponse.json(
                { error: `Profil yangilashida xato: ${updateError.message}` },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'Avatar muvaffaqiyatli o\'chirildi'
        })
    } catch (error) {
        console.error('DELETE xatosi:', error)
        return NextResponse.json(
            { error: 'Server xatosi' },
            { status: 500 }
        )
    }
}
