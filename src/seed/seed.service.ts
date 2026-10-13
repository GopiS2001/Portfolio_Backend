import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';

import {
  AboutParagraph,
  Experience,
  Highlight,
  MarqueeItem,
  Project,
  SkillGroup,
  Stat,
} from '../content/entities/list.entities';
import { Profile } from '../content/entities/profile.entity';
import { Section } from '../content/entities/section.entity';
import { Settings } from '../content/entities/settings.entity';

/** Fills empty tables with the original website content so it looks identical on first run. */
@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  private async seed<T extends ObjectLiteral>(entity: EntityTarget<T>, rows: Partial<T>[]) {
    const repo = this.db.getRepository(entity);
    if (await repo.count()) return;
    await repo.save(rows.map((row, i) => ({ sortOrder: i + 1, ...row }) as unknown as T));
    this.logger.log(`Seeded ${repo.metadata.tableName}`);
  }

  async onModuleInit() {
    await this.seed(Profile, [
      {
        id: 1,
        name: 'Gopi',
        role: 'Full-Stack Developer',
        location: 'India',
        email: 'hello@example.com',
        phone: '+91 00000 00000',
        whatsapp: '',
        available: true,
        resumeUrl: '#',
        heroTitle: "Hi, I'm {name} — crafting",
        tagline:
          'I design and build fast, accessible, and beautifully crafted web products — from pixel-perfect interfaces to resilient backends.',
        contactIntro:
          'Have a project in mind, a role to fill, or just want to say hello? My inbox is always open — I usually reply within a day.',
        github: 'https://github.com/',
        linkedin: 'https://www.linkedin.com/',
        twitter: 'https://x.com/',
      },
    ] as Partial<Profile>[]);

    await this.seed(Settings, [{ id: 1, siteTitle: 'Gopi — Full-Stack Developer', headerCtaLabel: "Let's talk" }] as Partial<Settings>[]);

    await this.seed(Section, [
      { key: 'home', navLabel: 'Home', eyebrow: '', title: '', highlight: '', titleSuffix: '' },
      { key: 'about', navLabel: 'About', eyebrow: 'About', title: 'A developer with a', highlight: "designer's eye", titleSuffix: '.' },
      { key: 'skills', navLabel: 'Skills', eyebrow: 'Skills', title: 'The toolkit behind', highlight: 'the work', titleSuffix: '.' },
      { key: 'experience', navLabel: 'Experience', eyebrow: 'Experience', title: "Where I've", highlight: 'made an impact', titleSuffix: '.' },
      { key: 'projects', navLabel: 'Projects', eyebrow: 'Selected work', title: "Projects I'm", highlight: 'proud of', titleSuffix: '.' },
      { key: 'contact', navLabel: 'Contact', eyebrow: 'Contact', title: "Let's build something", highlight: 'remarkable', titleSuffix: '.' },
    ] as Partial<Section>[]);

    await this.seed(Stat, [
      { value: '5+', label: 'Years experience' },
      { value: '40+', label: 'Projects shipped' },
      { value: '25+', label: 'Happy clients' },
    ]);

    await this.seed(AboutParagraph, [
      { content: "I'm a developer who sits at the intersection of engineering and design. I care about the details users feel but rarely notice — smooth interactions, thoughtful typography, and interfaces that load instantly." },
      { content: "Over the years I've helped startups and established teams turn ambitious ideas into polished products. I enjoy owning features end to end: shaping the problem, designing the system, writing the code, and measuring the outcome." },
      { content: "When I'm not shipping, you'll find me exploring new tools, contributing to open source, or sketching interface ideas in a notebook." },
    ]);

    await this.seed(Highlight, [
      { title: 'Design-minded', text: 'Interfaces with craft, rhythm and clarity.' },
      { title: 'Performance-first', text: 'Core Web Vitals in the green, always.' },
      { title: 'End-to-end', text: 'From database schema to deploy pipeline.' },
      { title: 'Collaborative', text: 'Clear communication, async-friendly.' },
    ]);

    await this.seed(SkillGroup, [
      { title: 'Frontend', icon: 'layout', skills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'Motion', 'Redux'] },
      { title: 'Backend', icon: 'server', skills: ['Node.js', 'NestJS', 'Express', 'REST & GraphQL', 'Python', 'Auth'] },
      { title: 'Data & Cloud', icon: 'database', skills: ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Docker', 'AWS'] },
      { title: 'Tools & Craft', icon: 'wrench', skills: ['Git', 'Figma', 'Jest', 'Playwright', 'CI/CD', 'Accessibility'] },
    ]);

    await this.seed(
      MarqueeItem,
      ['React', 'Next.js', 'TypeScript', 'Node.js', 'Tailwind', 'MySQL', 'Docker', 'GraphQL', 'Figma', 'AWS'].map(
        (label) => ({ label }),
      ),
    );

    await this.seed(Experience, [
      {
        role: 'Senior Full-Stack Developer',
        company: 'Northwind Labs',
        period: '2023 — Present',
        location: 'Remote',
        description:
          [
          'Rebuilt the customer analytics dashboard in Next.js and TypeScript, cutting page load time by 58%.',
          'Designed a shared component library adopted across 4 product teams.',
          'Mentored 3 engineers and introduced a review culture focused on accessibility.',
        ].join('\n'),
        stack: ['Next.js', 'TypeScript', 'PostgreSQL'],
      },
      {
        role: 'Full-Stack Developer',
        company: 'Pixel & Co.',
        period: '2021 — 2023',
        location: 'Bengaluru',
        description:
          [
          'Shipped 15+ client websites and web apps with a focus on performance.',
          'Built a headless CMS integration that halved content publishing time.',
          'Automated deployments with CI pipelines and preview environments.',
        ].join('\n'),
        stack: ['React', 'Node.js', 'MongoDB'],
      },
      {
        role: 'Frontend Developer',
        company: 'Brightside Studio',
        period: '2019 — 2021',
        location: 'Chennai',
        description:
          [
          'Translated design systems into responsive, accessible UI components.',
          'Improved Lighthouse scores from the 60s to 95+ across marketing sites.',
        ].join('\n'),
        stack: ['JavaScript', 'SCSS', 'Figma'],
      },
    ]);

    await this.seed(Project, [
      {
        title: 'Aurora Analytics',
        description: 'A real-time analytics dashboard with live charts, team workspaces and granular permissions — built for speed at scale.',
        tags: ['Next.js', 'TypeScript', 'PostgreSQL', 'WebSockets'],
        liveUrl: '#',
        sourceUrl: '#',
        gradient: 'from-amber-300 via-orange-400 to-rose-500',
        featured: true,
      },
      {
        title: 'Lumen Commerce',
        description: 'Headless storefront with instant search, optimistic cart and a checkout flow tuned for conversion.',
        tags: ['React', 'Stripe', 'Tailwind'],
        liveUrl: '#',
        sourceUrl: '#',
        gradient: 'from-sky-300 via-indigo-400 to-violet-500',
      },
      {
        title: 'Noted',
        description: 'A minimalist, offline-first notes app with markdown, tags and end-to-end sync.',
        tags: ['PWA', 'IndexedDB', 'Node.js'],
        liveUrl: '#',
        sourceUrl: '#',
        gradient: 'from-emerald-300 via-teal-400 to-cyan-500',
      },
      {
        title: 'Atlas Travel',
        description: 'Trip planner with interactive maps, collaborative itineraries and smart budget tracking.',
        tags: ['Next.js', 'Mapbox', 'Prisma'],
        liveUrl: '#',
        sourceUrl: '#',
        gradient: 'from-fuchsia-300 via-pink-400 to-rose-500',
      },
      {
        title: 'Pulse UI',
        description: 'An open-source component library with 40+ accessible, themeable components and full docs.',
        tags: ['React', 'Storybook', 'A11y'],
        liveUrl: '#',
        sourceUrl: '#',
        gradient: 'from-yellow-200 via-lime-300 to-emerald-400',
      },
    ]);
  }
}
