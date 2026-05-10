export default {
  name: 'settings',
  title: 'Site Settings',
  type: 'document',
  __experimental_actions: ['update', 'publish'],
  fields: [
    {
      name: 'facebook',
      title: 'Facebook URL',
      type: 'url',
    },
    {
      name: 'instagram',
      title: 'Instagram URL',
      type: 'url',
    },
    {
      name: 'founded',
      title: 'Founded Year',
      type: 'string',
    },
    {
      name: 'members',
      title: 'Member Count',
      type: 'string',
      description: 'Displayed on the homepage stats (e.g. "20+")',
    },
  ],
  preview: {
    select: { title: 'facebook' },
    prepare() {
      return { title: 'Site Settings' }
    },
  },
}
