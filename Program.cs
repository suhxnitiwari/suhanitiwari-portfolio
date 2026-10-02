using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.StaticFiles;
using System.Threading.RateLimiting;

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

app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
