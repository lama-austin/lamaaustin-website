export default {
  name: 'member',
  title: 'Chapter Member',
  type: 'document',
  fields: [
    {
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: Rule => Rule.required(),
    },
    {
      name: 'section',
      title: 'Section',
      type: 'string',
      options: {
        list: [
          { title: 'Full Patch', value: 'full-patch' },
          { title: 'Probate', value: 'probate' },
          { title: 'Prospect', value: 'prospect' },
          { title: 'Associate', value: 'associate' },
          { title: 'Dama de LAMA', value: 'dama-de-lama' },
        ],
        layout: 'radio',
      },
      validation: Rule => Rule.required(),
    },
    {
      name: 'photo',
      title: 'Photo',
      type: 'image',
      options: { hotspot: true },
    },
    {
      name: 'joined',
      title: 'Date Joined',
      type: 'date',
      description: 'Used to sort by seniority. Oldest date appears first.',
    },
    {
      name: 'draft',
      title: 'Draft (hidden)',
      type: 'boolean',
      initialValue: false,
    },
  ],
  preview: {
    select: { title: 'name', subtitle: 'section', media: 'photo' },
  },
  orderings: [
    { title: 'Date Joined (oldest first)', name: 'joinedAsc', by: [{ field: 'joined', direction: 'asc' }] },
  ],
}
