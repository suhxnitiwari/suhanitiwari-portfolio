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

    // The whole site is one long home page now. Old page addresses land on their part of it, and a #section
    // on the old address carries over (/home/study#marketing opens the Marketing Minor tab on the home page).
    // A server redirect can't see the #part, so this tiny page does the hop in the browser.
    private ContentResult ToHome(string section) => Content(
        $"<!doctype html><meta charset=\"utf-8\"><title>Suhani Tiwari</title>" +
        $"<script>location.replace('/' + (location.hash.replace('#mk-title-', '#mk-proj-') || '#{section}'))</script>" +
        $"<a href=\"/#{section}\">Continue to suhanitiwari.com</a>", "text/html");

    // The homepage introduces; the Study page holds the depth: why MIS and McCombs,
    // coursework (MIS and Marketing) and scholarships. Old addresses land on their part of it.
    private ContentResult ToStudy(string section) => Content(
        $"<!doctype html><meta charset=\"utf-8\"><title>Suhani Tiwari</title>" +
        $"<script>location.replace('/study' + (location.hash || '#{section}'))</script>" +
        $"<a href=\"/study#{section}\">Continue to suhanitiwari.com/study</a>", "text/html");

    [Route("study")]
    [Route("home/study")]
    public IActionResult Study()
    {
        ViewData["Part"] = "study";
        return View("Pursue");
    }

    // Marketing: my Marketing minor's projects on their own page
    [Route("marketing")]
    public IActionResult Marketing() => View();

    public IActionResult Education() => ToHome("education");

    public IActionResult Coursework() => ToStudy("coursework");

    public IActionResult BeyondTheClassroom() => ToHome("beyond");

    // How I Work moved to its own site; old links land there
    public IActionResult HowIWork() => Redirect("https://suhxnitiwari.github.io/how-i-work/");

    // Work, Study and the old Pursue page are parts of the home page now
    public IActionResult Work() => ToHome("experience");

    public IActionResult Pursue() => ToHome("experience");

    // Case studies: one editorial page per project, linked from the Projects board
    [Route("work/starbucks")]
    public IActionResult Starbucks() => View("CaseStarbucks");

    // /career: the one link to send a recruiter, the Work page
    [Route("career")]
    public IActionResult Career() => Redirect("/#experience");

    public IActionResult ScholarshipsAndAwards() => ToStudy("awards");

    // Off the Clock (my favorites) moved to its own site; old links land there
    public IActionResult Favorites() => Redirect("https://suhxnitiwari.github.io/off-the-clock/");

    // "Résumé": my résumé once wwwroot/resume.pdf exists, a short holding page until then
    // suhanitiwari.com/quiz: a direct link for people who just want to take How Well Do You Know Me?
    [Route("quiz")]
    public IActionResult Quiz() => Redirect("/#quiz");

    // suhanitiwari.com/mis: how I define the MIS major, opened straight to the MIS Major tab of Coursework
    [Route("mis")]
    public IActionResult Mis() => Redirect("/study#mis");

    // suhanitiwari.com/projects: straight to the things I've built
    [Route("projects")]
    public IActionResult Projects() => Redirect("/#selected-work");

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

    // Passions is the last big part of the home page
    public IActionResult Make() => ToHome("playground");

    // World moved out into its own project: github.com/suhxnitiwari/suhani-world

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
