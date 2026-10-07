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
        // the locked pages (You Had to Be There, Who Has My Heart, The Words That Stayed, Suhani's Sphere) live in the private
        // suhani-world repo, so their words stay out of this public one; they're compiled in (see the .csproj) and served only after login
        private const string Locked = "~/PrivateContent/world/portfolio-views/";

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

        // the visitor picks a role first, then proves it. Family's password also works for Friend,
        // but picking Friend only ever grants Friend: you get the role you asked for, never more.
        private string? Grant(string? role, string? password)
        {
            if (string.IsNullOrEmpty(password)) return null;
            var hasher = new PasswordHasher<object>();
            bool Matches(string? hash) => !string.IsNullOrEmpty(hash)
                && hasher.VerifyHashedPassword(new object(), hash, password) != PasswordVerificationResult.Failed;
            return role switch
            {
                Family => Matches(familyHash) ? Family : null,
                Friends => Matches(friendsHash) || Matches(familyHash) ? Friends : null,
                _ => null
            };
        }

        [HttpGet("/world/login")]
        public IActionResult Login(string? returnUrl = null)
        {
            if (User.Identity?.IsAuthenticated == true) return Redirect("/world/");
            ViewBag.IsOpen = IsOpen;
            ViewBag.ReturnUrl = returnUrl;
            // the Family Room's door sends people here with the family role already picked
            ViewBag.Role = returnUrl is not null && returnUrl.StartsWith("/world/family", StringComparison.OrdinalIgnoreCase) ? Family : Friends;
            return View();
        }

        [HttpPost("/world/login")]
        [ValidateAntiForgeryToken]
        [EnableRateLimiting("world-login")]
        public async Task<IActionResult> Login(string password, string? role, string? returnUrl = null)
        {
            ViewBag.IsOpen = IsOpen;
            ViewBag.ReturnUrl = returnUrl;
            ViewBag.Role = role == Family ? Family : Friends;
            if (!IsOpen) return View();

            var granted = Grant(role, password);
            if (granted is null)
            {
                ViewBag.Error = role == Family ? "That's not the family password." : "That's not it. Try again?";
                return View();
            }
            role = granted;

            var identity = new ClaimsIdentity(new[] { new Claim(ClaimTypes.Name, "guest"), new Claim(ClaimTypes.Role, role) }, "World");
            await HttpContext.SignInAsync("World", new ClaimsPrincipal(identity));
            // only ever send people somewhere inside My World; with nowhere asked for, family starts in the Family Room and friends on My World
            if (returnUrl is not null && returnUrl.StartsWith("/world/") && !returnUrl.StartsWith("//")) return Redirect(returnUrl);
            return Redirect(role == Family ? "/world/family/" : "/world/");
        }

        // If You Know Me: the personal part of the home page (the flip cards and the quiz), for friends and family only
        [Authorize(AuthenticationSchemes = "World")]
        [HttpGet("/world/you-know")]
        public IActionResult YouKnow()
        {
            Response.Headers.CacheControl = "private, no-store";
            Response.Headers["X-Robots-Tag"] = "noindex, nofollow";
            return View(Locked + "YouKnow.cshtml");
        }

        // Faces: photos with my friends, for friends and family only
        [Authorize(AuthenticationSchemes = "World")]
        [HttpGet("/world/faces")]
        public IActionResult Faces()
        {
            Response.Headers.CacheControl = "private, no-store";
            Response.Headers["X-Robots-Tag"] = "noindex, nofollow";
            return View(Locked + "Faces.cshtml");
        }

        // Words: the handmade cards and letters, for friends and family only
        [Authorize(AuthenticationSchemes = "World")]
        [HttpGet("/world/words")]
        public IActionResult Words()
        {
            Response.Headers.CacheControl = "private, no-store";
            Response.Headers["X-Robots-Tag"] = "noindex, nofollow";
            return View(Locked + "Words.cshtml");
        }

        // Suhani's Sphere: photos of me, my concerts and my favorites, for friends and family only
        [Authorize(AuthenticationSchemes = "World")]
        [HttpGet("/world/sphere")]
        public IActionResult Sphere()
        {
            Response.Headers.CacheControl = "private, no-store";
            Response.Headers["X-Robots-Tag"] = "noindex, nofollow";
            return View(Locked + "Sphere.cshtml");
        }

        // log out: forget the My World cookie and go back to the main site
        [HttpPost("/world/logout")]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync("World");
            return Redirect("/");
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
