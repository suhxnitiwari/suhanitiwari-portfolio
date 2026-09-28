# suhanitiwari.com

My personal portfolio site. I'm Suhani Tiwari, an MIS student at McCombs, UT Austin, with interests in psychology, marketing and product. The site is meant to show both sides of me: the work and the person behind it.

Live at **[suhanitiwari.com](https://suhanitiwari.com)**.

## What's on the site

| Page | What it shows |
|---|---|
| **Hello** (home) | A hero with a tagline, "If you know me, you know…" flip cards, "If I were a…" cards, and a "How well do you know Suhani?" quiz |
| **World** | An interactive map of the places I've lived, a "Pieces of Me" puzzle, and my favorite spots on campus and around Austin |
| **Favorites** | Listen (my Spotify top artists as a zoomable "music universe"), Watch (TED talks by topic, rom-coms, comfort shows) and Read |
| **Make** | Drawing, writing, baking, cooking and traveling shelves, with pop-up cards for recipes, artwork and trips |
| **Pursue** | Education, Coursework, Beyond the Classroom, How I Work, and Scholarships and Awards |
| **Résumé** | My résumé |

A few features I'm proud of:

- **MIS curriculum cycle** (Coursework, MIS Major tab): an interactive diagram of how my MIS courses connect, from strategy to technical skills to building to delivery. Each course opens to show its skills and the big question it taught me to ask. A zoom-lens slider and other sections tell the story around it.
- **How I Work:** my CliftonStrengths as a stepped slideshow, and my RIASEC results as a real hexagon chart.
- **Pieces of Me puzzle** (World): an SVG jigsaw built in JavaScript. Each piece opens to show what it gave me.
- **Music universe** (Favorites): my live Spotify top artists, sized by how much I listen to them.

## Built with

- **ASP.NET Core MVC** on .NET 10, with Razor views
- Plain **HTML, CSS and JavaScript** (no front-end framework)
- **Leaflet** for the World map, with OpenStreetMap data
- **Spotify Web API** for the Listen section
- **Docker**, deployed on **Render** from the `main` branch

## Project structure

```
Controllers/
  HomeController.cs      one action per page
  SpotifyController.cs   Spotify login and my top artists, songs and genres (cached for 12 hours)
Services/
  SpotifyService.cs      talks to the Spotify API
Views/
  Home/                  one Razor view per page; most page content lives as data at the top of each view
  Shared/_Layout.cshtml  navigation, footer and shared styles
wwwroot/
  css/                   shared styles (shelves, MIS cycle, coursework story)
  js/                    shared scripts (shelves, pop-up cards, topic filters)
  images/                photos, artwork and map backgrounds
Dockerfile               builds and runs the site on Render
```

## Running it locally

You'll need the [.NET 10 SDK](https://dotnet.microsoft.com/download).

```bash
dotnet build
dotnet run --launch-profile http
```

Then open http://localhost:5142.

Everything works without any setup except the Listen section, which needs Spotify credentials. To turn it on, add your own app's keys with user secrets:

```bash
dotnet user-secrets set "Spotify:ClientId" "<your client id>"
dotnet user-secrets set "Spotify:ClientSecret" "<your client secret>"
```

Then open http://127.0.0.1:5142/spotify/login to connect an account (the redirect URI in `appsettings.json` must match your Spotify app). The saved login (`spotify-token.json`) stays on your machine and is kept out of git and out of published builds.

## Deployment

Render builds the `Dockerfile` on every push to `main`. On the live site, the Spotify keys and refresh token come from environment variables (`Spotify__ClientId`, `Spotify__ClientSecret`, `Spotify__RefreshToken`). Connecting a new Spotify account is switched off there unless `Spotify__AllowConnect=true` is set.

## Contact

[LinkedIn](https://www.linkedin.com/in/suhxnitiwari) or suhxnitiwari@gmail.com
