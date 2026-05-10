export default {
  name: 'leadership',
  title: 'Leadership',
  type: 'document',
  fields: [
    {
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: Rule => Rule.required(),
    },
    {
      name: 'role',
      title: 'Title / Role',
      type: 'string',
      description: 'e.g. President, Vice President',
      validation: Rule => Rule.required(),
    },
    {
      name: 'photo',
      title: 'Photo',
      type: 'image',
      options: { hotspot: true },
    },
    {
      name: 'weight',
      title: 'Display Order',
      type: 'number',
      description: 'Lower = appears first. Use 1 for President, 2 for VP, etc.',
      initialValue: 10,
    },
    {
      name: 'draft',
      title: 'Draft (hidden)',
      type: 'boolean',
      initialValue: false,
    },
  ],
  preview: {
    select: { title: 'name', subtitle: 'role', media: 'photo' },
  },
  orderings: [
    { title: 'Display Order', name: 'weightAsc', by: [{ field: 'weight', direction: 'asc' }] },
  ],
}
