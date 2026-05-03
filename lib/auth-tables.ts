export type AppRole = 'admin' | 'tarbiyachi' | 'talaba' | null

export async function findRoleByUserId(supabase: any, userId: string): Promise<AppRole> {
  const { data: staffData } = await supabase
    .from('staff')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (staffData?.role === 'admin' || staffData?.role === 'tarbiyachi') {
    return staffData.role
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (userData?.role === 'talaba') {
    return 'talaba'
  }

  return null
}
