using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Tiwari_Suhani_HW3.Models;

namespace Tiwari_Suhani_HW3.Controllers;

public class HomeController : Controller
{
    public IActionResult Index()
    {
        return View();
    }

    public IActionResult Education()
    {
        return View();
    }

    public IActionResult Coursework()
    {
        return View();
    }

    public IActionResult BeyondTheClassroom()
    {
        return View();
    }

    // How I Work moved to its own site; old links land there
    public IActionResult HowIWork() => Redirect("https://suhxnitiwari.github.io/how-i-work/");

    // Work: what I've done (experience, projects, leadership, awards)
    public IActionResult Work()
    {
        ViewData["Part"] = "work";
        return View("Pursue");
    }

    // Study: what I'm learning and why (why MIS, why McCombs, coursework)
    public IActionResult Study()
    {
        ViewData["Part"] = "study";
        return View("Pursue");
    }

    // The old one-page Pursue address still works: it shows Work, and a Study link (#coursework, #mis...) hops to Study
    public IActionResult Pursue()
    {
        ViewData["Part"] = "work";
        return View("Pursue");
    }

    // Case studies: one editorial page per project, linked from the Projects board
    [Route("work/starbucks")]
    public IActionResult Starbucks() => View("CaseStarbucks");

    // /career: the one link to send a recruiter, the Work page
    [Route("career")]
    public IActionResult Career() => Redirect("/home/work");

    public IActionResult ScholarshipsAndAwards()
    {
        return View();
    }

    // Off the Clock (my favorites) moved to its own site; old links land there
    public IActionResult Favorites() => Redirect("https://suhxnitiwari.github.io/off-the-clock/");

    // "Résumé": my résumé once wwwroot/resume.pdf exists, a short holding page until then
    // suhanitiwari.com/quiz: a direct link for people who just want to take How Well Do You Know Me?
    [Route("quiz")]
    public IActionResult Quiz() => Redirect("/#quiz");

    // suhanitiwari.com/mis: how I define the MIS major, opened straight to the MIS Major tab of Coursework
    [Route("mis")]
    public IActionResult Mis() => Redirect("/home/study#mis");

    // suhanitiwari.com/projects: straight to the things I've built
    [Route("projects")]
    public IActionResult Projects() => Redirect("/home/work#projects");

    [Route("resume")]
    public IActionResult Resume([FromServices] IWebHostEnvironment environment)
    {
        if (System.IO.File.Exists(Path.Combine(environment.WebRootPath, "resume.pdf")))
        {
            return Redirect("/Tiwari_Suhani_Resume.pdf");
        }
        return View();
    }

    // The résumé opens in the browser, and saving it from there names the file Tiwari_Suhani_Resume.pdf
    [Route("Tiwari_Suhani_Resume.pdf")]
    public IActionResult ResumeFile([FromServices] IWebHostEnvironment environment)
    {
        var path = Path.Combine(environment.WebRootPath, "resume.pdf");
        if (!System.IO.File.Exists(path)) return Redirect("/resume");
        Response.Headers.ContentDisposition = "inline; filename=\"Tiwari_Suhani_Resume.pdf\"";
        return PhysicalFile(path, "application/pdf");
    }

    // suhanitiwari.com/resume/download: the PDF saved as Tiwari_Suhani_Resume.pdf
    [Route("resume/download")]
    public IActionResult ResumeDownload([FromServices] IWebHostEnvironment environment)
    {
        var path = Path.Combine(environment.WebRootPath, "resume.pdf");
        if (!System.IO.File.Exists(path)) return Redirect("/resume");
        return PhysicalFile(path, "application/pdf", "Tiwari_Suhani_Resume.pdf");
    }

    public IActionResult Make()
    {
        return View();
    }

    // World moved out into its own project: github.com/suhxnitiwari/suhani-world

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
