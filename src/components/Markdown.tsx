import { memo, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import katex from 'katex';

/**
 * Markdown + LaTeX (KaTeX). No se permite HTML crudo (react-markdown lo escapa), así que el contenido
 * escrito por el profesor no puede inyectar scripts. Los vídeos se insertan con un bloque:
 *
 * ```video
 * https://www.youtube.com/watch?v=XXXX
 * ```
 */

function videoEmbed(raw: string): ReactNode {
  const url = raw.trim();
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return <p className="text-sm text-red-600">Enlace de vídeo inválido.</p>;
  }
  if (u.protocol !== 'https:') return <p className="text-sm text-red-600">El vídeo debe usar https.</p>;
  let src: string | null = null;
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtube.com' || host === 'm.youtube.com') src = u.searchParams.get('v') && `https://www.youtube-nocookie.com/embed/${u.searchParams.get('v')}`;
  else if (host === 'youtu.be') src = `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
  else if (host === 'vimeo.com') src = `https://player.vimeo.com/video/${u.pathname.split('/').filter(Boolean)[0]}`;
  if (src && /^https:\/\/[\w./-]+$/.test(src)) {
    return (
      <div className="my-4 aspect-video w-full overflow-hidden rounded-lg bg-black">
        <iframe
          src={src}
          title="Vídeo"
          className="h-full w-full"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
        />
      </div>
    );
  }
  if (/\.(mp4|webm|ogg)$/i.test(u.pathname)) {
    return <video src={url} controls preload="metadata" className="my-4 w-full rounded-lg" />;
  }
  return (
    <p>
      <a href={url} target="_blank" rel="noreferrer noopener" className="enlace">
        Ver vídeo
      </a>
    </p>
  );
}

const components: Components = {
  pre({ node, children }) {
    const code = node?.children?.[0] as { tagName?: string; properties?: { className?: string[] }; children?: { value?: string }[] } | undefined;
    if (code?.tagName === 'code' && code.properties?.className?.includes('language-video')) {
      return <>{videoEmbed(code.children?.[0]?.value ?? '')}</>;
    }
    return <pre className="my-3 overflow-x-auto rounded-lg bg-gray-100 p-3 text-sm dark:bg-white/10">{children}</pre>;
  },
  a({ href, children }) {
    const external = href && /^https?:/.test(href);
    return (
      <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer noopener' : undefined}>
        {children}
      </a>
    );
  },
  img({ src, alt }) {
    return <img src={src} alt={alt ?? ''} loading="lazy" />;
  },
};

/**
 * remark-math solo trata como ecuación destacada el bloque con «$$» en líneas propias.
 * Los autores escriben a menudo «$$ x = x_0 + v t $$» en una sola línea: se convierte a la forma de bloque.
 */
export function normalizeDisplayMath(md: string): string {
  return md.replace(/^([ \t]*)\$\$([^\n]+?)\$\$[ \t]*$/gm, (_m, indent: string, tex: string) => `${indent}$$\n${indent}${tex.trim()}\n${indent}$$`);
}

export const Markdown = memo(function Markdown({ children, className = '' }: { children: string | null | undefined; className?: string }) {
  if (!children) return null;
  return (
    <div className={`prosa ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore', trust: false }]]}
        components={components}
      >
        {normalizeDisplayMath(children)}
      </ReactMarkdown>
    </div>
  );
});

/** Ecuación LaTeX suelta. */
export function Tex({ children, display = false, className = '' }: { children: string; display?: boolean; className?: string }) {
  const html = katex.renderToString(children, { displayMode: display, throwOnError: false, strict: 'ignore', trust: false });
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Texto corto con Markdown en línea (sin párrafo envolvente). */
export function InlineMd({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore', trust: false }]]}
      components={{ p: ({ children: c }) => <>{c}</> }}
    >
      {children}
    </ReactMarkdown>
  );
}
