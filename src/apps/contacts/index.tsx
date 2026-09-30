import { useCallback } from 'react'
import { NavStack, Page, useNav, BarButton } from '../../ui/nav'
import { useOnscreen } from '../../os/hooks'
import { contactById } from '../../os/data/people'
import { useOS } from '../../os/store'
import { Plus } from 'lucide-react'
import { ContactsList } from './ContactsList'
import { ContactDetailPage } from './ContactDetail'
import { fullName, useRouteOnce } from './shared'
import './contacts.css'

export default function ContactsApp() {
  return (
    <div className="app-root">
      <NavStack root={<Root />} />
    </div>
  )
}

function Detail({ id }: { id: string }) {
  const c = contactById(id)
  useOnscreen('contacts', c ? `Viewing contact ${fullName(c)}` : 'My Card', { type: 'contact', contactId: id, name: c ? fullName(c) : 'Jamie Park' })
  return <ContactDetailPage id={id} />
}

function Root() {
  const nav = useNav()
  const open = useCallback((id: string) => nav.push(<Detail id={id} />, `contact-${id}-${Date.now()}`), [nav])
  useRouteOnce('contacts', (route) => {
    const m = route.match(/^contact\/(.+)$/)
    if (m && (contactById(m[1]) || m[1] === 'me')) {
      nav.popToRoot()
      window.setTimeout(() => open(m[1]), 60)
    }
  })
  useOnscreen('contacts', 'Contacts list')
  return (
    <Page
      title="Contacts"
      trailing={
        <BarButton label="Add Contact" onClick={() => useOS.getState().showToast('New contacts sync from iCloud', '☁️')}>
          <Plus size={24} strokeWidth={2.2} />
        </BarButton>
      }
    >
      <ContactsList onOpen={open} />
    </Page>
  )
}
