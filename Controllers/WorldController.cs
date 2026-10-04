using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;

namespace Tiwari_Suhani_HW3.Controllers
{
    // My World: the people and places that made me, behind a password. The pages come from the
    // private suhani-world repo and sit outside wwwroot, so the only way to them is through here.
    // Two passwords, two roles: friends see My World, family sees it plus the Family Room (/world/family/).
    public class WorldController : Controller
    {
        private const string Family = "family", Friends = "friends";
        private readonly string? friendsHash, familyHash;
        private readonly PhysicalFileProvider? pages;
        private static readonly FileExtensionContentTypeProvider ContentTypes = new();

        public WorldController(IConfiguration config, IWebHostEnvironment env)
        {
            friendsHash = config["World:PasswordHash"];
            familyHash = config["World:FamilyPasswordHash"];
            var root = Path.Combine(env.ContentRootPath, "PrivateContent", "world", "published");
            pages = Directory.Exists(root) ? new PhysicalFileProvider(root) : null;
        }

        // open only when there's a password set and the pages made it into the build
        private bool IsOpen => (!string.IsNullOrEmpty(friendsHash) || !string.IsNullOrEmpty(familyHash)) && pages is not null;

        // which role a password unlocks, or null; family is checked first, so family never lands as a friend
        private string? RoleFor(string? password)
        {
            if (string.IsNullOrEmpty(password)) return null;
            var hasher = new PasswordHasher<object>();
            bool Matches(string? hash) => !string.IsNullOrEmpty(hash)
                && hasher.VerifyHashedPassword(new object(), hash, password) != PasswordVerificationResult.Failed;
            return Matches(familyHash) ? Family : Matches(friendsHash) ? Friends : null;
        }

        [HttpGet("/world/login")]
        public IActionResult Login(string? returnUrl = null)
        {
            if (User.Identity?.IsAuthenticated == true) return Redirect("/world/");
            ViewBag.IsOpen = IsOpen;
            ViewBag.ReturnUrl = returnUrl;
            return View();
        }

        [HttpPost("/world/login")]
        [ValidateAntiForgeryToken]
        [EnableRateLimiting("world-login")]
        public async Task<IActionResult> Login(string password, string? returnUrl = null)
        {
            ViewBag.IsOpen = IsOpen;
            ViewBag.ReturnUrl = returnUrl;
            if (!IsOpen) return View();

            var role = RoleFor(password);
            if (role is null)
            {
                ViewBag.Error = "That's not it. Try again?";
                return View();
            }

            var identity = new ClaimsIdentity(new[] { new Claim(ClaimTypes.Name, "guest"), new Claim(ClaimTypes.Role, role) }, "World");
            await HttpContext.SignInAsync("World", new ClaimsPrincipal(identity));
            // only ever send people somewhere inside My World
            return Redirect(returnUrl is not null && returnUrl.StartsWith("/world/") && !returnUrl.StartsWith("//") ? returnUrl : "/world/");
        }

        // who's visiting, so the page can show family the door to the Family Room (the room itself checks again below)
        [Authorize(AuthenticationSchemes = "World")]
        [HttpGet("/world/me")]
        public IActionResult Me()
        {
            Response.Headers.CacheControl = "private, no-store";
            return Json(new { role = User.IsInRole(Family) ? Family : Friends });
        }

        [Authorize(AuthenticationSchemes = "World")]
        [HttpGet("/world/{**path}")]
        public IActionResult Page(string? path)
        {
            if (pages is null) return NotFound();
            // /world → /world/ and /world/family → /world/family/, so relative links (css/, images/) resolve inside them
            if (string.IsNullOrEmpty(path) && !(Request.Path.Value ?? "").EndsWith('/')) return Redirect("/world/");
            if (string.Equals(path, Family, StringComparison.OrdinalIgnoreCase)) return Redirect("/world/family/");

            // the Family Room: a friend's cookie gets a closed door, not the files
            if ((path ?? "").Split('/', 2)[0].Equals(Family, StringComparison.OrdinalIgnoreCase) && !User.IsInRole(Family))
            {
                Response.StatusCode = StatusCodes.Status403Forbidden;
                Response.Headers.CacheControl = "private, no-store";
                return View("FamilyOnly");
            }

            // the file provider refuses anything that climbs out of the folder (../)
            var name = string.IsNullOrEmpty(path) ? "index.html" : path.EndsWith('/') ? path + "index.html" : path;
            var file = pages.GetFileInfo(name);
            if (!file.Exists || file.IsDirectory || file.PhysicalPath is null) return NotFound();

            // private: never kept by a shared cache, never indexed
            Response.Headers.CacheControl = "private, no-store";
            Response.Headers["X-Robots-Tag"] = "noindex, nofollow";
            var type = ContentTypes.TryGetContentType(file.Name, out var t) ? t : "application/octet-stream";
            return PhysicalFile(file.PhysicalPath, type);
        }
    }
}
