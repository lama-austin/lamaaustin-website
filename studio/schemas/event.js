export default {
  name: 'event',
  title: 'Event / Ride',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Event Name',
      type: 'string',
      validation: Rule => Rule.required(),
    },
    {
      name: 'date',
      title: 'Date',
      type: 'datetime',
      validation: Rule => Rule.required(),
    },
    {
      name: 'time',
      title: 'Event Time',
      type: 'string',
      description: 'e.g. 8:00 AM',
    },
    {
      name: 'location',
      title: 'Meet Location',
      type: 'string',
    },
    {
      name: 'type',
      title: 'Event Type',
      type: 'string',
      options: {
        list: [
          { title: 'Ride', value: 'ride' },
          { title: 'Social', value: 'social' },
          { title: 'State Event', value: 'state' },
        ],
        layout: 'radio',
      },
    },
    {
      name: 'facebook',
      title: 'Facebook Event URL',
      type: 'url',
    },
    {
      name: 'description',
      title: 'Description',
      type: 'array',
      of: [{ type: 'block' }],
    },
    {
      name: 'draft',
      title: 'Draft (hidden)',
      type: 'boolean',
      initialValue: false,
    },
  ],
  preview: {
    select: { title: 'title', subtitle: 'date' },
    prepare({ title, subtitle }) {
      return { title, subtitle: subtitle ? subtitle.slice(0, 10) : '' }
    },
  },
  orderings: [
    { title: 'Date (newest first)', name: 'dateDesc', by: [{ field: 'date', direction: 'desc' }] },
  ],
}
