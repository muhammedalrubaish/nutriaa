import { route } from '@/lib/api'
import { PERMS } from '@/lib/roles'
import { listOrderUsers } from '@/lib/repo'

// Names for the order log's user filter. Open to report viewers, unlike /api/users (account management).
export default route({
  GET: {
    perm: PERMS.VIEW_REPORTS,
    handle: async (req, res) => res.status(200).json({ users: await listOrderUsers() }),
  },
})
