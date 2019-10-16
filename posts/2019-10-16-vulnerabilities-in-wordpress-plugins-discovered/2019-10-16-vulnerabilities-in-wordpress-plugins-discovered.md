# Vulnerabilities in Wordpress Plugins Discovered

In september I had the opportunity to take a closer look at some WordPress plugins at work.
I did not have any knowledge about the mechanics of WordPress plugins or the features of WordPress core which can be used in custom code before.
By checking the source code of the plugins I learned a lot and soon discovered some vulnerabilities.
Many plugins have a huge code base. Often I just analysed only a small part of the code.

The original write-ups were published on the github page of my employer, so I will only add a few comments here. Links to the detailed write-up can be found below:

## Plugin: EU Cookie Law (GDPR)

- Active Installations: 100,000+
- Vulnerability Type: Stored XSS
- Required Privileges: high (admin)
- Status: not fixed
- CVE: [CVE-2019-16522](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2019-16522)
- Plugin Page: <https://wordpress.org/plugins/eu-cookie-law/>
- **Detailed Writeup: [WordPress Plugin - EU Cookie Law (GDPR) - Stored XSS](https://github.com/sbaresearch/advisories/tree/public/2019/SBA-ADV-20190913-01_WordPress_Plugin_EU_Cookie_Law)**

When I first contacted the authors, I got a reply relatively fast. After the question how the disclosure should be handled, was answered I sent them the details of the vulnerability. Then there was silence and even after asking again I never got any further reply. This is exactly how it should not be done...

This vulnerability requires high privileges to be exploited, but still you do not want an admin to have the possibility to steal another admin or users plaintext password with ease. Furthermore there shouldn't be the possibility to perform actions on behalf of other users without their knowledge. By using this vulnerability all of this could be done easily.

## Plugin: Broken Link Checker

- Active Installations: 700,000+
- Vulnerability Type: Reflected XSS
- Required Privileges: none
- Status: not fixed
- CVE: [CVE-2019-16521](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2019-16521)
- Plugin Page: <https://wordpress.org/plugins/broken-link-checker/>
- **Detailed Writeup: [WordPress Plugin - Broken Link Checker - Reflected XSS](https://github.com/sbaresearch/advisories/tree/public/2019/SBA-ADV-20190913-02_WordPress_Plugin_Broken_Link_Checker)**

It took several days until I got the first reply of the author only to learn in a follow-up that they are not maintaining it any more. They also suggested that I could use their premium plugin with similar functionality (lol). I was pretty surprised by this because of the significant amount of active installations this plugin had.

This vulnerability is quite dangerous, because an attacker can exploit this without any user account. Sending a prepared link to an admin user who opens it can have a serious impact. This could even lead to the installation of a PHP backdoor or the execution of PHP code in the context of the admin if there are no special security restrictions in place.

## Plugin: Events Manager

- Active Installations: 100,000+
- Vulnerability Type: Stored XSS
- Required Privileges: low (user)
- Status: fixed
- CVE: [CVE-2019-16523](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2019-16523)
- Plugin Page: <https://wordpress.org/plugins/events-manager/>
- **Detailed Writeup: [WordPress Plugin - Events Manager - Stored XSS](https://github.com/sbaresearch/advisories/tree/public/2019/SBA-ADV-20190913-03_WordPress_Plugin_Events_Manager)**

The author responded fast to my initial mail and verified the vulnerability report on the same day. He was very nice throughout the whole conversation and appreciated the report. He credited me in the changelog without having to ask for it. Others should take this as an example.

With this plugin I learned a few things about WordPress shortcodes. Ususally their attributes are sanitized and protected against XSS. When the plugin itself transforms the value of the attributes (like using base64 or other encodings as attribute value) those protections can be bypassed.

## Plugin: All in One SEO Pack

- Active Installations: 2+ million
- Vulnerability Type: Stored XSS
- Required Privileges: low (user)
- Status: fixed
- CVE: [CVE-2019-16520](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2019-16520)
- Plugin Page: <https://wordpress.org/plugins/all-in-one-seo-pack/>
- **Detailed Writeup: [WordPress Plugin - All in One SEO Pack - Stored XSS](https://github.com/sbaresearch/advisories/tree/public/2019/SBA-ADV-20190913-04_WordPress_Plugin_All_in_One_SEO_Pack)**

The author of this plugin responded professionally and quickly to the vulnerability report. Within the same day the issue was fixed and a new version of the plugin published for download.

The interesting part of this vulnerability was that it could be found in one of the main features -- providing customized meta descriptions and titles for blog posts. Those fields were, each considered on their own, properly encoded. The feature of inserting a user controlled field (the title) inside another one was overlooked and allowed insertion of XSS payloads.
Also the amount of active installations and subsequently the amount of affected websites was impressive.

## Summary

Of the four vulnerabilities two are still unfixed. This might be the case even for a longer time. Especially the broken link checker is dangerous because it can be exploited by an external attacker without any privileges.

Some developers do not appreciate vulnerability reports, even when they are free and ignore problematic issues. Others however behave professionally and care about their products and the security of their users.

Furthermore, this was the first time I reported CVEs. Actually the process is very simple as described on [cve.mitre.org](https://cve.mitre.org/cve/request_id.html):
- First a CNA has to be chosen
- Then the initial report has to be sent, for open source software this is the [CVE request form](https://cveform.mitre.org/) by MITRE
- After a few days you will get a reply and (possibly) get a CVE ID
- Then some time later when you publish the write-up, the same form can be used to inform MITRE about the public disclosure. In my case they responded very fast (within a few hours).
