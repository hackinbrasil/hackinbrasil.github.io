source "https://rubygems.org"

ruby "~> 3.2.0"

# Not using the `github-pages` gem: it pins jekyll-remote-theme -> rubyzip < 3.0
# (vulnerable). We don't use remote themes; these match what Pages 232 ships.
gem "jekyll", "4.4.1"
gem "kramdown-parser-gfm", "1.1.0"

group :jekyll_plugins do
  gem "jekyll-seo-tag", "2.8.0"
  gem "jekyll-sitemap", "1.4.0"
end

gem "faraday", "2.14.4"

# Needed for local `bundle exec jekyll serve`
gem "webrick", "~> 1.8"
