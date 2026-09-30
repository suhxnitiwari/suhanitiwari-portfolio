using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace Tiwari_Suhani_HW3.Controllers
{
    // 30-second song previews from the iTunes Search API (free, no key). Spotify stopped giving out previews,
    // so the On Repeat list asks here instead: /music/preview?title=...&artist=...
    public class MusicController : Controller
    {
        private readonly IHttpClientFactory _http;
        private readonly IMemoryCache _cache;

        public MusicController(IHttpClientFactory http, IMemoryCache cache)
        {
            _http = http;
            _cache = cache;
        }

        public record Preview(string PreviewUrl, string TrackUrl);

        [HttpGet]
        [Route("music/preview")]
        public async Task<IActionResult> GetPreview(string title, string artist)
        {
            if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(artist) || title.Length > 150 || artist.Length > 100)
                return BadRequest();

            // a song's preview never changes, so each answer is kept for a week (including "no match")
            var key = $"itunes:{Clean(title)}|{Clean(artist)}";
            var preview = await _cache.GetOrCreateAsync(key, async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(7);
                return await LookUp(title, artist);
            });
            return preview == null ? NotFound() : Json(preview);
        }

        private async Task<Preview?> LookUp(string title, string artist)
        {
            try
            {
                var client = _http.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(8);
                var term = Uri.EscapeDataString($"{title} {artist}");
                using var doc = JsonDocument.Parse(await client.GetStringAsync(
                    $"https://itunes.apple.com/search?term={term}&entity=song&limit=10&country=US"));

                string wantTitle = Clean(title), wantArtist = Clean(artist);
                foreach (var r in doc.RootElement.GetProperty("results").EnumerateArray())
                {
                    if (!r.TryGetProperty("previewUrl", out var p)) continue;
                    var gotArtist = Clean(r.GetProperty("artistName").GetString() ?? "");
                    var gotTitle = Clean(r.GetProperty("trackName").GetString() ?? "");
                    // only a real match: same artist, and the same song title (ignoring "(feat. …)" and punctuation)
                    if (!gotArtist.Contains(wantArtist) && !wantArtist.Contains(gotArtist)) continue;
                    if (!gotTitle.StartsWith(wantTitle) && !wantTitle.StartsWith(gotTitle)) continue;
                    var url = r.TryGetProperty("trackViewUrl", out var t) ? t.GetString() ?? "" : "";
                    return new Preview(p.GetString() ?? "", url);
                }
            }
            catch (Exception) { }
            return null;
        }

        // lowercase, no accents, nothing in brackets, letters and numbers only
        private static string Clean(string s)
        {
            s = Regex.Replace(s, @"[\(\[].*?[\)\]]", "");
            s = s.Split(" - ")[0];
            var plain = new StringBuilder();
            foreach (var ch in s.Normalize(NormalizationForm.FormD))
                if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark && char.IsLetterOrDigit(ch))
                    plain.Append(char.ToLowerInvariant(ch));
            return plain.ToString();
        }
    }
}
