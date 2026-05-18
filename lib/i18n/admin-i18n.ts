import { useLocale } from 'next-intl'
import enMessages from '@/messages/en.json'
import ruMessages from '@/messages/ru.json'
import uzMessages from '@/messages/uz.json'

type MessagePath =
    | 'admin.dashboard.title'
    | 'admin.dashboard.welcome'
    | 'admin.dashboard.total_students'
    | 'admin.dashboard.total_applications'
    | 'admin.dashboard.total_users'
    | 'admin.dashboard.this_month'
    | 'admin.dashboard.quick_actions'
    | 'admin.dashboard.refresh_stats'
    | 'admin.dashboard.refresh_stats_desc'
    | 'admin.dashboard.system_status'
    | 'admin.dashboard.system_status_desc'
    | 'admin.navigation.dashboard'
    | 'admin.navigation.applications'
    | 'admin.navigation.users'
    | 'admin.navigation.reports'
    | 'admin.navigation.settings'
    | 'admin.navigation.logout'
    | 'admin.users.title'
    | 'admin.users.search_placeholder'
    | 'admin.users.total_users'
    | 'admin.users.filter'
    | 'admin.users.filter_by_role'
    | 'admin.users.role'
    | 'admin.users.email'
    | 'admin.users.name'
    | 'admin.users.created'
    | 'admin.users.actions'
    | 'admin.users.edit'
    | 'admin.users.delete'
    | 'admin.users.roles.talaba'
    | 'admin.users.roles.tarbiyachi'
    | 'admin.users.roles.admin'
    | 'admin.users.confirm_delete'
    | 'admin.users.delete_success'
    | 'admin.users.delete_error'
    | 'admin.users.edit_role'
    | 'admin.users.save'
    | 'admin.users.cancel'
    | 'admin.applications.title'
    | 'admin.applications.search_placeholder'
    | 'admin.applications.status_all'
    | 'admin.applications.status_new'
    | 'admin.applications.status_approved'
    | 'admin.applications.status_rejected'
    | 'admin.applications.status_pending'
    | 'admin.applications.student'
    | 'admin.applications.title_label'
    | 'admin.applications.description'
    | 'admin.applications.status'
    | 'admin.applications.date'
    | 'admin.applications.actions'
    | 'admin.applications.view'
    | 'admin.applications.approve'
    | 'admin.applications.reject'
    | 'admin.applications.comment'
    | 'admin.applications.approve_success'
    | 'admin.applications.reject_success'
    | 'admin.reports.title'
    | 'admin.reports.students_by_faculty'
    | 'admin.reports.monthly_applications'
    | 'admin.reports.user_growth'
    | 'admin.reports.system_performance'
    | 'admin.reports.export'
    | 'admin.reports.export_pdf'
    | 'admin.reports.export_excel'
    | 'admin.reports.export_csv'
    | 'admin.settings.title'
    | 'admin.settings.system'
    | 'admin.settings.security'
    | 'admin.settings.notifications'
    | 'admin.settings.maintenance_mode'
    | 'admin.settings.maintenance_mode_desc'
    | 'admin.settings.enable'
    | 'admin.settings.disable'
    | 'admin.settings.enable_notifications'
    | 'admin.settings.two_factor'
    | 'admin.settings.ip_whitelist'
    | 'admin.settings.session_timeout'
    | 'admin.settings.save_settings'
    | 'admin.settings.save_success'
    | 'admin.settings.save_error'
    | 'admin.common.loading'
    | 'admin.common.error'
    | 'admin.common.success'
    | 'admin.common.confirm'
    | 'admin.common.cancel'
    | 'admin.common.close'
    | 'admin.common.yes'
    | 'admin.common.no'
    | 'admin.common.select'
    | 'admin.common.no_data'
    | 'admin.common.page'

// Translation storage
const translations = {
    uz: uzMessages,
    en: enMessages,
    ru: ruMessages,
}

export function getNestedTranslation(obj: unknown, path: string): string {
    const result = path.split('.').reduce<unknown>((current, prop) => {
        if (typeof current === 'object' && current !== null && prop in current) {
            return (current as Record<string, unknown>)[prop]
        }
        return undefined
    }, obj)
    return typeof result === 'string' ? result : path
}

export function useTranslation() {
    const locale = useLocale()

    return {
        t: (key: MessagePath): string => {
            const messages = translations[locale as keyof typeof translations] || translations.en
            return getNestedTranslation(messages, key)
        },
        locale,
    }
}
