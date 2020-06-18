const GhostContentAPI = require('@tryghost/content-api');
const yaml = require('js-yaml');
const fs = require('fs-extra');
const path = require('path');

// On Netlify,these environment variables are set in the admin.
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const ghostURL = process.env.GHOST_URL;
const ghostKey = process.env.GHOST_KEY;
const api = new GhostContentAPI({
	url: ghostURL,
	key: ghostKey,
	version: 'v3'
});

const createMdFilesFromGhost = async () => {
    console.time('All posts converted to Markdown in');

    try {
        // Fetch the posts from the Ghost Content API
        const posts = await api.posts.browse({
            limit: 'all',
            include: 'tags,authors',
            formats: ['html'],
        });

        await Promise.all(posts.map(async (post) => {
            let content = post.html;
            
            const frontmatter = {
                title: post.meta_title || post.title,
                description: post.meta_description || post.excerpt,
                pagetitle: post.title,
                slug: post.slug,
                feature_image: post.feature_image,
                lastmod: post.updated_at,
                date: post.published_at,
                summary: post.excerpt,
                i18nlanguage: 'en', // Change for your language
                weight: post.featured ? 1 : 0,
                draft: post.visibility !== 'public',
            };

            if (post.og_title) {
                frontmatter.og_title = post.og_title
            }

            if (post.og_description) {
                frontmatter.og_description = post.og_description
            }

            // The format of og_image is /content/images/2020/04/social-image-filename.jog
            // without the root of the URL. Prepend if necessary.
            let ogImage = post.og_image || post.feature_image || '';
            if (!ogImage.includes('https://your_ghost.url')) {
                ogImage = 'https://your_ghost.url' + ogImage
            }
            frontmatter.og_image = ogImage;

            if (post.tags && post.tags.length) {
                frontmatter.categories = post.tags.map(t => t.name);
            }

            // There should be at least one author.
            if (!post.authors || !post.authors.length) {
                return;
            }

            // Rewrite the avatar url for a smaller one.
            frontmatter.authors = post.authors.map((author) => ({ 
                ...author,
                profile_image: author.profile_image.replace('content/images/', 'content/images/size/w100/'),
            }));

            // If there's a canonical url, please add it.
            if (post.canonical_url) {
                frontmatter.canonical = post.canonical_url;
            }

            // Create frontmatter properties from all keys in our post object
            const yamlPost = await yaml.dump(frontmatter);

            // Super simple concatenating of the frontmatter and our content
            const fileString = `---\n${yamlPost}\n---\n${content}\n`;

            // Save the final string of our file as a Markdown file
            await fs.writeFile(path.join('content/posts', `${post.slug}.md`), fileString, { flag: 'w' });
        }));

    console.timeEnd('All posts converted to Markdown in');
    } catch (error) {
        console.error(error);
    }
};

module.exports = createMdFilesFromGhost();