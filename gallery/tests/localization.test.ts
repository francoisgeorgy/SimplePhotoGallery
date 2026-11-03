import { GalleryDataSchema } from '../../common/src/gallery';
import { resolveGalleryData } from '../../common/src/theme';

describe('gallery localization', () => {
  test('resolves translated album text for themes', async () => {
    const gallery = GalleryDataSchema.parse({
      title: 'After Hours',
      description: 'Night **photographs**',
      defaultLanguage: 'en',
      translations: {
        en: {
          title: 'After Hours',
          description: 'Night **photographs**',
        },
        fr: {
          title: 'Après la tombée de la nuit',
          description: 'Photographies **de nuit**',
        },
      },
      headerImage: 'night.jpg',
      metadata: {},
      sections: [{ images: [] }],
      subGalleries: {
        title: 'Albums',
        galleries: [
          {
            title: 'City',
            headerImage: 'city.jpg',
            path: '../city',
            translations: {
              en: {
                title: 'City',
                description: 'City photographs',
              },
              fr: {
                title: 'Ville',
                description: 'Photographies urbaines',
              },
            },
          },
        ],
      },
    });

    const resolved = await resolveGalleryData(gallery);

    expect(resolved.defaultLanguage).toBe('en');
    expect(resolved.hero.translations?.fr).toEqual({
      title: 'Après la tombée de la nuit',
      description: 'Photographies **de nuit**',
      parsedDescription: '<p>Photographies <strong>de nuit</strong></p>\n',
    });
    expect(resolved.subGalleries?.galleries[0]?.translations?.fr.title).toBe('Ville');
  });
});
