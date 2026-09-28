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

    [Route("resume")]
    public IActionResult Resume([FromServices] IWebHostEnvironment environment)
    {
        if (System.IO.File.Exists(Path.Combine(environment.WebRootPath, "resume.pdf")))
        {
            return Redirect("/resume.pdf");
        }
        return View();
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
