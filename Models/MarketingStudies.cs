namespace Tiwari_Suhani_HW3.Models;

// One marketing study's shareable address (suhanitiwari.com/marketing/{Slug}) and the link preview it shows.
// Deck = the id after "mk-proj-" in Views/Home/_MarketingWork.cshtml. Title and Line are each deck's own cover words.
public record MarketingStudy(string Slug, string Deck, string Title, string Line, string Image);

public static class MarketingStudies
{
    public static readonly MarketingStudy[] All =
    {
        new("glossier", "glossier", "How Glossier Lost Its Cult",
            "First it lost the group chat. Glossier was built by its comments section, then handed its fans to Sephora and TikTok. Here’s how to win them back.",
            "/videos/projects/glossier.jpg"),
        new("rhode", "rhode", "Rhode Has a Hailey Problem",
            "A $390M beauty brand runs on one face. Here’s how to make it outlive the fame.",
            "/videos/projects/rhode.jpg"),
        new("bollywood-beauty", "bollywood", "Same Fame, Different Fates",
            "Three A-list actresses launched beauty brands. One grew, one was sold, one is shrinking. Why?",
            "/videos/projects/bollywood-cover.jpg"),
        new("american-eagle", "americaneagle", "40 Billion Impressions, 1% Growth",
            "Did the Sydney Sweeney controversy sell the jeans? For one season. Here’s how to make it sell the brand.",
            "/videos/projects/americaneagle.jpg"),
        new("netflix", "netflix", "Netflix’s $20B Leak",
            "Netflix makes the hits. YouTube, TikTok and Reddit keep the fans. Here’s how to take them back.",
            "/videos/projects/netflix.jpg"),
        new("prime-book-club", "primebookclub", "All Hype, No Club",
            "Prime Video turned BookTok’s favorite books into its biggest hits. Its book club reaches under 1% of the people watching them. Here’s how to make it a real club.",
            "/videos/projects/primebookclub.jpg"),
        new("fuelflow", "fuelflow", "FuelFlow: Smart Nutrition for Campus",
            "The help exists. Nobody walks to it. So we put it where they already are.",
            "/videos/projects/fuelflow-cover.jpg"),
        new("starbucks", "starbucks", "Starbucks AI Loyalty & Mobile Ecosystem",
            "Starbucks’ app holds $12 billion a year. It’s a glorified gift card.",
            "/videos/projects/starbucks-cover.jpg"),
        new("owala", "owala", "Owala: The Marathon Series",
            "Nobody needs a second Owala. So make them earn one. City-exclusive, engraved with your finish time, only sold to runners.",
            "/videos/projects/owala-cover.jpg"),
        new("wendys", "wendys", "Wendy’s: Everything Ties Back to the Beef",
            "Fresh quality, everyday value and convenience: Wendy’s position since 1969. I mapped every activity that holds it up, and six new ones I’d add.",
            "/videos/projects/wendys-cover.jpg"),
        new("crowdstrike", "crowdstrike", "CrowdStrike: The Rival in Every Force",
            "How much can a cloud security company earn? I mapped the five forces around CrowdStrike, from the 2021 case to July 2026. One name kept showing up: Microsoft.",
            "/videos/projects/crowdstrike-cover.jpg")
    };

    public static MarketingStudy? Find(string? slug) =>
        All.FirstOrDefault(s => string.Equals(s.Slug, slug, StringComparison.OrdinalIgnoreCase));

    public static MarketingStudy? ForDeck(string deck) => All.FirstOrDefault(s => s.Deck == deck);
}
