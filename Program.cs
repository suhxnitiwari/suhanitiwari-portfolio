using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.StaticFiles;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();
builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();   // keeps a copy of my Spotify data between visits
builder.Services.AddScoped<Tiwari_Suhani_HW3.Services.SpotifyService>();

// On Render the site sits behind a proxy that handles HTTPS; this lets the app see the
// original https address instead of the proxy's plain http one.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
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
// frame my pages to trick clicks, and links out don't leak full page addresses
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "SAMEORIGIN";
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    await next();
});
// serve my Python files too (wwwroot/py), so the Saturday planner can run in the browser
var contentTypes = new FileExtensionContentTypeProvider();
contentTypes.Mappings[".py"] = "text/plain; charset=utf-8";
app.UseStaticFiles(new StaticFileOptions { ContentTypeProvider = contentTypes });

app.UseRouting();

app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
