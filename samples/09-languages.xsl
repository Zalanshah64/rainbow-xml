<?xml version="1.0" encoding="UTF-8"?>
<!--
  09b  LANGUAGES: XSL

  VS Code opens .xsl files in their own "XSL" language mode (bottom-right
  of the window), so this file is NOT colored with the default
  "rainbowXml.languages": ["xml"].

  Check:
  - With the defaults, nothing here is rainbow-colored.
  - Run "Rainbow XML: Toggle" from the Command Palette: this file turns on,
    even though xsl isn't in the list. Run it again to turn it off.
    The toggle only affects this file and resets when the file is closed.
  - Set "rainbowXml.languages": ["xml", "xsl"]: now it's colored without
    the toggle.
-->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" indent="yes"/>
  <xsl:template match="/">
    <html>
      <body>
        <xsl:for-each select="catalog/item">
          <xsl:if test="price &gt; 10">
            <p><xsl:value-of select="name"/></p>
          </xsl:if>
        </xsl:for-each>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
