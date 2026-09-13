import re

from bs4 import BeautifulSoup
from datetime import datetime, timedelta

player_list = {
    "Zander": "Zander",
    "Trey Moment": "Trey",
    "Sean.": "Sean",
    "Lili": "Lili",
    "Brody": "Brody",
    "Rashidi": "Rashidi",
    "Jonas": "Jonas",
    "Hyper-Realistic Blood.": "Cooldude",
    "Sib": "Silas",
    "Multi": "Bill",
    "Michael": "Michael",
    "ScootyDooty": "Preston",
    "Hunter": "Hunter",
    "Tatsu": "FFBot",
    "Æsir": "Charles",
    "FF 8Ball": "FFBot",
}

# Discord nicknames aren't unique — GheeseEmpty (Maxwell) was also nicknamed
# "Zander" for part of FF3, colliding with lastingParadox's actual "Zander"
# nickname. data-user-id is the stable per-account identifier, so resolve
# through it first and only fall back to the nickname-keyed player_list above
# when a user's id isn't one of these known collisions.
player_list_by_user_id = {
    "185741003209179136": "Maxwell",  # GheeseEmpty, nicknamed "Zander" in FF3
}

character_list = {
    "Zander": "Emmett",
    "Trey": "Garrick",
    "Sean": "Seth",
    "Lili": "Iris",
    "Brody": "Sanya",
    "Rashidi": "Dakari",
    "Jonas": "Chomsky",
    "Cooldude": "Wemmfort",
    "Silas": "Wes",
    "Bill": "Burner",
    "Michael": "Theylin",
    "Preston": "Volentina",
    "Hunter": "Rachell",
    "Charles": "Vargas",
    "Maxwell": "Mateo",
}


# Brody/Brakia's "D: ..." is Sanya's Dread persona talking, not Sanya — call it
# out with the same backtick speaker-override convention FF2 uses for Dread
# (`` `Dread`: line ``), rather than leaving the bare "D:" text as-is. Discord
# also shows these wrapped in stray "~"s (a player-typed "telepathic voice"
# marker); once the D: is called out as `Dread`, the tildes are redundant.
DREAD_PREFIX = re.compile(r"(^|[~*])D:\s*")


def apply_dread_convention(text, author):
    if author != "Brody":
        return text
    text = DREAD_PREFIX.sub(r"\1`Dread`: ", text)
    return text.replace("~", "")


def parse_timestamp(timestamp_str):
    """
    Parse the timestamp string to a datetime object.
    """
    return datetime.strptime(timestamp_str, "%d-%b-%y %I:%M %p")


def should_combine(previous_timestamp, current_timestamp):
    """
    Determine if two messages should be combined based on their timestamps.
    """
    time_difference = current_timestamp - previous_timestamp
    return time_difference <= timedelta(minutes=5)


def extract_messages(html_content):
    soup = BeautifulSoup(html_content, "html.parser")
    messages = []
    message_groups = soup.find_all(class_="chatlog__messages")

    previous_author = None
    previous_timestamp = None
    previous_element = None
    combined_message = ""

    for group in message_groups:
        author_name_element = group.find(class_="chatlog__author-name")
        author_user_id = (
            author_name_element.get("data-user-id") if author_name_element else None
        )
        if author_user_id in player_list_by_user_id:
            author = player_list_by_user_id[author_user_id]
        else:
            author = player_list.get(
                (
                    author_name_element.get_text(strip=True)
                    if author_name_element
                    else "Unknown"
                ),
                "Unknown",
            )
        timestamp = parse_timestamp(
            group.find(class_="chatlog__timestamp").get_text(strip=True)
            if group.find(class_="chatlog__timestamp")
            else "Unknown"
        )
        content_elements = group.find_all(class_="chatlog__message")
        combine_previous = (
            author == previous_author
            and previous_timestamp
            and should_combine(previous_timestamp, timestamp)
        )

        for content_element in content_elements:
            content = ""

            markdown_container = content_element.find(class_="markdown")
            preserve_whitespace = (
                markdown_container.find(class_="preserve-whitespace")
                if markdown_container
                else None
            )

            if preserve_whitespace:
                preserve_whitespace_text = preserve_whitespace.get_text().strip("\n")
                previous_element = previous_element if combine_previous else None

                # If there's a strong element, we want to bold the entire message
                strong_elements = preserve_whitespace.find_all("strong")
                if len(strong_elements) > 0:
                    img_content = preserve_whitespace.find("img", alt=True)
                    if img_content:
                        content += f"{img_content['alt']}{preserve_whitespace_text}"
                    else:
                        content += preserve_whitespace_text

                else:
                    # Direct children only (not findChildren()'s recursive
                    # descendants) so that NavigableString text nodes sitting
                    # next to <em>/mention/img/etc. siblings are visited too —
                    # findChildren() only returns Tags, silently dropping any
                    # plain text that isn't wrapped in an element.
                    preserve_whitespace_children = markdown_container.find(
                        class_="preserve-whitespace"
                    ).contents
                    for element in preserve_whitespace_children:
                        if isinstance(element, str):
                            stripped = apply_dread_convention(
                                element.strip("\n"), author
                            )
                            content += stripped
                            # A bare whitespace text node (e.g. the "\n" Discord
                            # inserts between an <em> action and a following
                            # pre--inline quote) shouldn't reset previous_element —
                            # that would suppress the separator the next element
                            # inserts based on what actually preceded it.
                            if stripped.strip():
                                previous_element = "other"
                        elif element.name == "em":
                            temp = apply_dread_convention(
                                element.get_text().strip("\n"), author
                            )
                            # Only break onto a new paragraph if there's
                            # something before it to separate from — content
                            # is still "" when this em is the first thing in
                            # the message, and a leading "\n\n" there just
                            # left two blank lines under the message header.
                            if previous_element != "em" and content:
                                content += "\n\n"
                            content += f"*{temp}*"
                            previous_element = "em"
                        elif element.name == "span" and "pre--inline" in element.get(
                            "class", []
                        ):
                            temp = element.get_text().strip("\n")
                            if previous_element == "em":
                                content += "\n"
                            character_name = character_list.get(author, "Person")
                            content += f"> `{character_name}`: {temp}"
                            previous_element = "pre--inline"
                        else:
                            content += element.get_text().strip("\n")
                            previous_element = "other"
                    if len(preserve_whitespace_children) == 0:
                        content += markdown_container.get_text().strip("\n")

                # Discord's "(edited)" marker is a sibling of preserve-whitespace,
                # not a descendant of it — carry it through as its own line so
                # md-to-api.py's existing "bare (edited) lines are dropped" rule
                # still gets a line to drop.
                if markdown_container.find(class_="chatlog__edited-timestamp"):
                    content += "\n(edited)"

            content = content.replace("’", "'")
            # If

            if combine_previous:
                combined_message += "\n" + content
            else:
                if combined_message.strip():
                    messages.append(
                        {
                            "author": previous_author,
                            "timestamp": previous_timestamp.strftime(
                                "%d-%b-%y %I:%M %p"
                            ),
                            "content": combined_message,
                        }
                    )
                combined_message = content

            previous_author = author
            previous_timestamp = timestamp

    # Adding the last message if any
    if combined_message.strip():
        messages.append(
            {
                "author": previous_author,
                "timestamp": previous_timestamp.strftime("%d-%b-%y %I:%M %p"),
                "content": combined_message,
            }
        )

    return messages


def convert_to_markdown(messages):
    markdown = ""
    for msg in messages:
        markdown += f"**{msg['author']}** *({msg['timestamp']})*\n{msg['content']}\n\n"
    return markdown


def parse_html_to_markdown(file_path):
    with open(file_path, "r") as file:
        html_content = file.read()

    messages = extract_messages(html_content)
    return convert_to_markdown(messages)


# Example usage:
markdown_content = parse_html_to_markdown("/home/trey/Documents/final-frontier/ff-site/ff-site-old/archive-to-markdown/ff-archive/ff3.html")
markdown_content = re.sub(r"\n\(edited\)", "", markdown_content)

with open("./md/ff3/ff3.md", "w") as file:
    file.write(markdown_content)
