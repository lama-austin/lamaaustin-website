export default {
  name: 'galleryAlbum',
  title: 'Gallery Album',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Album Name',
      type: 'string',
      validation: Rule => Rule.required(),
    },
    {
      name: 'date',
      title: 'Event Date',
      type: 'date',
    },
    {
      name: 'location',
      title: 'Location',
      type: 'string',
    },
    {
      name: 'photos',
      title: 'Photos',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'image', title: 'Photo', type: 'image', options: { hotspot: true } },
            { name: 'caption', title: 'Caption', type: 'string' },
          ],
          preview: {
            select: { title: 'caption', media: 'image' },
            prepare({ title, media }) {
              return { title: title || 'No caption', media }
            },
          },
        },
      ],
    },
    {
      name: 'draft',
      title: 'Draft (hidden)',
      type: 'boolean',
      initialValue: false,
    },
  ],
  preview: {
    select: { title: 'title', subtitle: 'date', media: 'photos.0.image' },
  },
  orderings: [
    { title: 'Date (newest first)', name: 'dateDesc', by: [{ field: 'date', direction: 'desc' }] },
  ],
}
