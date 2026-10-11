# Public social-video retrieval: development smoke tests

Implemented: a bounded yt-dlp adapter feeds the same Gemini/Exa analysis service used by uploads and YouTube. No extra paid provider, browser cookies, login credentials, candidate-library recordings, or external media-downloader process. The Python dependency is pinned to the installed stable version 2026.8.19 in an ignored local environment.

| Public input | Retrieval result | Measured time |
|---|---|---:|
| User TikTok share `https://www.tiktok.com/t/ZPLhVCWeN/` | 26 seconds, 969,063 bytes; video retrieved | 1.888s standalone; 1.490s in pipeline |
| Same TikTok, complete real-provider pipeline | Provisional speech and visual clues, three candidates; strongest indexed text match 15 words. No original recording verified. | 11.769s server pipeline |
| Instagram official extractor fixture `https://www.instagram.com/reel/Chunk8-jurw/` | 918,120 bytes, audio reported absent, duration not supplied. Retrieval succeeds after explicitly supporting silent media. | 2.463s |
| X official extractor fixture `https://twitter.com/starwars/status/665052190608723968` | Retrieval failed on default and syndication paths; no claim that X works on this machine yet | 0.416s first run; 0.248s syndication retest |

These are repeated development trials, not cold-run, held-out source accuracy or browser click-to-render measurements. Instagram was retrieval-tested only; no speech-discovery success is established. X failure may reflect the particular post or current platform access. No private access or challenge bypass is attempted.

Initial failures were diagnostic: external-tool version detection was disabled because it was unnecessary; the TikTok media request needed the same anonymous session cookies as its public page request; Instagram's silent formats were initially excluded. None involved importing user cookies or credentials.

Bounds: 5 seconds for retrieval within the existing 17-second server deadline; zero configured network retries; 8 MB streamed byte limit; known durations above 180 seconds rejected; analysis requested only up to 180 seconds if duration is unknown. Only direct MP4 formats are accepted. Split audio/video requiring merging and unsupported playlists are outside the scope. A successful download does not establish complete analysis, source identity or original-upload status.

28 Node tests pass (including a Python guard suite). New checks cover exact host/post routing, stripping tracking parameters, private/loopback IP and port rejection, format/duration/byte filters, blocked external processes, cancellation, temporary-file cleanup, and withholding provider secrets from the helper environment. Source-discovery accuracy is not established by these tests.

Official references: [yt-dlp installation](https://github.com/yt-dlp/yt-dlp/wiki/Installation), [supported sites and caveats](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md), [Twitter extractor](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/twitter.py), [Instagram extractor](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/instagram.py), [TikTok extractor](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/tiktok.py).

Browser smoke test of the same TikTok link: 9.651s server time. Speech was extracted from the downloaded video and the report rendered. The repeated search returned only related pages without a matching passage. Final-result handling now calls that inconclusive, rather than conflating retrieval success with source discovery. A collection is rejected instead of silently analyzing its first video.
