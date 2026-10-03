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
    public class WorldController : Controller
    {
        private readonly string? passwordHash;
        private readonly PhysicalFileProvider? pages;
        private static readonly FileExtensionContentTypeProvider ContentTypes = new();

        public WorldController(IConfiguration config, IWebHostEnvironment env)
        {
            passwordHash = config["World:PasswordHash"];
            var root = Path.Combine(env.ContentRootPath, "PrivateContent", "world", "published");
            pages = Directory.Exists(root) ? new PhysicalFileProvider(root) : null;
        }

        // open only when there's a password set and the pages made it into the build
        private bool IsOpen => !string.IsNullOrEmpty(passwordHash) && pages is not null;

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

            var result = string.IsNullOrEmpty(password)
                ? PasswordVerificationResult.Failed
                : new PasswordHasher<object>().VerifyHashedPassword(new object(), passwordHash!, password);
            if (result == PasswordVerificationResult.Failed)
            {
                ViewBag.Error = "That's not it. Try again?";
                return View();
            }

            var identity = new ClaimsIdentity(new[] { new Claim(ClaimTypes.Name, "guest") }, "World");
            await HttpContext.SignInAsync("World", new ClaimsPrincipal(identity));
            // only ever send people somewhere inside My World
            return Redirect(returnUrl is not null && returnUrl.StartsWith("/world/") && !returnUrl.StartsWith("//") ? returnUrl : "/world/");
        }

        [Authorize(AuthenticationSchemes = "World")]
        [HttpGet("/world/{**path}")]
        public IActionResult Page(string? path)
        {
            if (pages is null) return NotFound();
            // /world → /world/, so the page's relative links (css/, images/) resolve inside it
            if (string.IsNullOrEmpty(path) && !(Request.Path.Value ?? "").EndsWith('/')) return Redirect("/world/");
            // the file provider refuses anything that climbs out of the folder (../)
            var file = pages.GetFileInfo(string.IsNullOrEmpty(path) ? "index.html" : path);
            if (!file.Exists || file.IsDirectory || file.PhysicalPath is null) return NotFound();

            // private: never kept by a shared cache, never indexed
            Response.Headers.CacheControl = "private, no-store";
            Response.Headers["X-Robots-Tag"] = "noindex, nofollow";
            var type = ContentTypes.TryGetContentType(file.Name, out var t) ? t : "application/octet-stream";
            return PhysicalFile(file.PhysicalPath, type);
        }
    }
}
