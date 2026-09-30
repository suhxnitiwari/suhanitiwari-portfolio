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

    public IActionResult HowIWork()
    {
        return View();
    }

    // Pursue: all five Pursue pages stacked on one page you can keep scrolling through
    public IActionResult Pursue()
    {
        return View();
    }

    // /career: the one link to send a recruiter. Same page as Pursue, which opens with who I am and my experience
    [Route("career")]
    public IActionResult Career() => View("Pursue");

    public IActionResult ScholarshipsAndAwards()
    {
        return View();
    }

    public IActionResult Favorites()
    {
        return View();
    }

    // "Résumé": my résumé once wwwroot/resume.pdf exists, a short holding page until then
    // suhanitiwari.com/quiz: a direct link for people who just want to take How Well Do You Know Me?
    [Route("quiz")]
    public IActionResult Quiz() => Redirect("/#quiz");

    // suhanitiwari.com/mis: how I define the MIS major, opened straight to the MIS Major tab of Coursework
    [Route("mis")]
    public IActionResult Mis() => Redirect("/home/pursue#mis");

    // suhanitiwari.com/projects: straight to the things I've built
    [Route("projects")]
    public IActionResult Projects() => Redirect("/home/pursue#projects");

    [Route("resume")]
    public IActionResult Resume([FromServices] IWebHostEnvironment environment)
    {
        if (System.IO.File.Exists(Path.Combine(environment.WebRootPath, "resume.pdf")))
        {
            return Redirect("/resume.pdf");
        }
        return View();
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

    public IActionResult World()
    {
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
