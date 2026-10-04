using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.StaticFiles;
using System.Threading.RateLimiting;

// `dotnet run -- hash-world-password` turns a password into the hash My World checks against.
// The password is typed without echoing and never saved; only the printed hash goes into a setting
// on Render: World__PasswordHash for friends, World__FamilyPasswordHash for family.
if (args.Length > 0 && args[0] == "hash-world-password")
{
    Console.Write("Password for My World: ");
    string password;
    if (Console.IsInputRedirected)
    {
        password = Console.ReadLine() ?? "";
    }
    else
    {
        var typed = new System.Text.StringBuilder();
        for (var key = Console.ReadKey(intercept: true); key.Key != ConsoleKey.Enter; key = Console.ReadKey(intercept: true))
        {
            if (key.Key == ConsoleKey.Backspace) { if (typed.Length > 0) typed.Length--; }
            else typed.Append(key.KeyChar);
        }
        password = typed.ToString();
    }
    Console.WriteLine();
    Console.WriteLine(new PasswordHasher<object>().HashPassword(new object(), password));
    return;
}

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();
builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();   // keeps a copy of my Spotify data between visits
builder.Services.AddScoped<Tiwari_Suhani_HW3.Services.SpotifyService>();

// Off the Clock lives on its own site now (GitHub Pages) but still gets my live Spotify music from here,
// so that one site may read the /spotify and /music answers. Nothing else changes for anyone else.
builder.Services.AddCors(options => options.AddPolicy("OffTheClock", policy =>
{
    policy.WithOrigins("https://suhxnitiwari.github.io").WithMethods("GET");
    if (builder.Environment.IsDevelopment()) policy.SetIsOriginAllowed(_ => true).WithMethods("GET");
}));

// On Render the site sits behind a proxy that handles HTTPS; this lets the app see the
// original https address instead of the proxy's plain http one.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

// Each visitor gets 60 music requests a minute (one page load uses about 6), so nobody can
// hammer the Spotify, MusicBrainz and Wikipedia lookups through my site. Pages themselves aren't limited.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        (context.Request.Path.StartsWithSegments("/spotify") || context.Request.Path.StartsWithSegments("/music"))
            ? RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 60, Window = TimeSpan.FromMinutes(1) })
            : RateLimitPartition.GetNoLimiter("pages"));
});

// My World (/world) is private: a friends password and a family password, each checked against a PBKDF2 hash
// (never the password itself); the one you used decides your role. Then an encrypted cookie that only
// works under /world, only over HTTPS, never from another site,
// and runs out after two hours of not using it
builder.Services.AddAuthentication("World").AddCookie("World", options =>
{
    options.LoginPath = "/world/login";
    options.Cookie.Name = "world";
    options.Cookie.Path = "/world";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    options.ExpireTimeSpan = TimeSpan.FromHours(2);
    options.SlidingExpiration = true;
});

builder.Services.Configure<Microsoft.AspNetCore.RateLimiting.RateLimiterOptions>(options =>
{
    // five password tries per visitor every 15 minutes, so nobody can guess their way in
    options.AddPolicy("world-login", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(15) }));
});

var app = builder.Build();

app.UseForwardedHeaders();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

// basic safety headers on every response: browsers won't guess file types, other sites can't
// frame my pages to trick clicks (only my own Listening History site may show a live preview),
// and links out don't leak full page addresses
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["Content-Security-Policy"] = "frame-ancestors 'self' https://listening-history.onrender.com";
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    // pages are always re-checked, so nobody keeps seeing an old version after I push a change
    context.Response.OnStarting(() =>
    {
        var type = context.Response.ContentType ?? "";
        if (type.StartsWith("text/html") && !context.Response.Headers.ContainsKey("Cache-Control"))
            context.Response.Headers["Cache-Control"] = "no-cache";
        return Task.CompletedTask;
    });
    await next();
});
// serve my Python files too (wwwroot/py), so the Saturday planner can run in the browser
var contentTypes = new FileExtensionContentTypeProvider();
contentTypes.Mappings[".py"] = "text/plain; charset=utf-8";
app.UseStaticFiles(new StaticFileOptions { ContentTypeProvider = contentTypes });

app.UseRouting();
app.UseCors();
app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
