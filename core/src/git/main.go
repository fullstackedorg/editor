package git

import (
	"encoding/json"
	"path"
	"strings"
	"time"

	git "github.com/go-git/go-git/v5"
	gitConfig "github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/cache"
	"github.com/go-git/go-git/v5/plumbing/format/gitignore"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/go-git/go-git/v5/storage/filesystem"

	fs "fullstacked/editor/src/fs"
	serialize "fullstacked/editor/src/serialize"
	setup "fullstacked/editor/src/setup"
	utils "fullstacked/editor/src/utils"
)

type GitMessageJSON struct {
	Url   string
	Data  string
	Error bool
}

func errorFmt(e error) string {
	gitError := GitMessageJSON{
		Data:  strings.ReplaceAll(strings.TrimSpace(e.Error()), "\"", "\\\""),
		Error: true,
	}
	jsonData, _ := json.Marshal(gitError)
	jsonStr := string(jsonData)
	return jsonStr
}

func getRepo(directory string) (*git.Repository, error) {
	repo := (*git.Repository)(nil)
	err := (error)(nil)

	if fs.WASM {
		wfs := WasmFS{
			root: directory + "/.git",
		}
		wfs2 := WasmFS{
			root: directory,
		}
		repo, err = git.Open(filesystem.NewStorage(wfs, cache.NewObjectLRUDefault()), wfs2)
	} else {
		repo, err = git.PlainOpen(directory)
	}

	if err != nil {
		return nil, err
	}

	return repo, nil
}

func getWorktree(directory string) (*git.Worktree, error) {
	repo, err := getRepo(directory)

	if err != nil {
		return nil, err
	}

	worktree, err := repo.Worktree()

	if err != nil {
		return nil, err
	}

	// always ignore FullStacked artifacts
	worktree.Excludes = append(worktree.Excludes,
		gitignore.ParsePattern("/.build", []string{}),
		gitignore.ParsePattern("/data", []string{}))

	return worktree, nil
}

type GitProgress struct {
	Name string
	Url  string
}

func (gitProgress *GitProgress) Write(p []byte) (int, error) {
	n := len(p)

	jsonData, _ := json.Marshal(GitMessageJSON{
		Url:   gitProgress.Url,
		Data:  strings.TrimSpace(string(p)),
		Error: false,
	})

	setup.Callback("", gitProgress.Name, string(jsonData))
	return n, nil
}

func (gitProgress *GitProgress) Error(message string) {
	jsonData, _ := json.Marshal(GitMessageJSON{
		Url:   gitProgress.Url,
		Data:  strings.ReplaceAll(strings.TrimSpace(message), "\"", "\\\""),
		Error: true,
	})

	setup.Callback("", gitProgress.Name, string(jsonData))
}

func Clone(into string, url string, username *string, password *string) {
	auth := (*http.BasicAuth)(nil)
	if username != nil && password != nil {
		auth = &http.BasicAuth{
			Username: *username,
			Password: *password,
		}
	}

	progress := GitProgress{
		Name: "git-clone",
		Url:  url,
	}

	err := (error)(nil)
	if fs.WASM {
		wfs := WasmFS{
			root: into + "/.git",
		}
		wfs2 := WasmFS{
			root: into,
		}
		_, err = git.Clone(filesystem.NewStorage(wfs, cache.NewObjectLRUDefault()), wfs2, &git.CloneOptions{
			Auth:     auth,
			URL:      url,
			Progress: &progress,
		})
	} else {
		_, err = git.PlainClone(into, false, &git.CloneOptions{
			Auth:     auth,
			URL:      url,
			Progress: &progress,
		})
	}

	if err != nil {
		progress.Error(err.Error())
		return
	}

	progress.Write([]byte("done"))
}

type HeadObj struct {
	Name string
	Hash string
}

func Head(directory string) []byte {
	repo, err := getRepo(directory)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	head, err := repo.Head()

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	headObj := HeadObj{
		Name: head.Name().Short(),
		Hash: head.Hash().String(),
	}

	jsonData, _ := json.Marshal(headObj)
	jsonStr := string(jsonData)
	return serialize.SerializeString(jsonStr)
}

type GitStatus struct {
	Added    []string
	Modified []string
	Deleted  []string
}

func Status(directory string) []byte {
	worktree, err := getWorktree(directory)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	err = worktree.AddGlob(".")
	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	status, err := worktree.Status()
	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	gitStatus := GitStatus{
		Added:    []string{},
		Modified: []string{},
		Deleted:  []string{},
	}

	for file, fileStatus := range status {
		if fileStatus.Staging == git.Added || fileStatus.Staging == git.Copied {
			gitStatus.Added = append(gitStatus.Added, file)
		} else if fileStatus.Staging == git.Deleted {
			gitStatus.Deleted = append(gitStatus.Deleted, file)
		} else {
			gitStatus.Modified = append(gitStatus.Modified, file)
		}
	}

	jsonData, _ := json.Marshal(gitStatus)
	jsonStr := string(jsonData)
	return serialize.SerializeString(jsonStr)
}

func Pull(directory string, username *string, password *string) {
	progress := GitProgress{
		Name: "git-pull",
	}

	worktree, err := getWorktree(directory)

	if err != nil {
		progress.Error(err.Error())
		return
	}

	repo, err := getRepo(directory)

	if err != nil {
		progress.Error(err.Error())
		return
	}

	remote, err := repo.Remote("origin")

	if err != nil {
		progress.Error(err.Error())
		return
	}

	progress.Url = remote.Config().URLs[0]

	progress.Write([]byte("start"))

	auth := (*http.BasicAuth)(nil)
	if username != nil && password != nil {
		auth = &http.BasicAuth{
			Username: *username,
			Password: *password,
		}
	}

	err = worktree.AddGlob(".")
	if err != nil {
		progress.Error(err.Error())
		return
	}

	head, err := repo.Head()

	if err != nil {
		progress.Error(err.Error())
		return
	}

	stash := stashDirectory(path.Join(directory, "data"))

	err = worktree.Pull(&git.PullOptions{
		Auth:          auth,
		ReferenceName: head.Name(),
		Progress:      &progress,
	})

	restoreDirectory(stash)

	if err != nil && err.Error() != "already up-to-date" {
		progress.Error(err.Error())
		return
	}

	progress.Write([]byte("done"))
}

func Push(directory string, username *string, password *string) {
	progress := GitProgress{
		Name: "git-push",
	}

	repo, err := getRepo(directory)

	if err != nil {
		progress.Error(err.Error())
		return
	}

	remote, err := repo.Remote("origin")

	if err != nil {
		progress.Error(err.Error())
		return
	}

	progress.Url = remote.Config().URLs[0]

	progress.Write([]byte("start"))

	auth := (*http.BasicAuth)(nil)
	if username != nil && password != nil {
		auth = &http.BasicAuth{
			Username: *username,
			Password: *password,
		}
	}

	err = repo.Push(&git.PushOptions{
		Auth: auth,
		Progress: &GitProgress{
			Name: "git-push",
		},
	})

	if err != nil {
		progress.Error(err.Error())
		return
	}

	progress.Write([]byte("done"))
}

func Restore(directory string, files []string) []byte {
	worktree, err := getWorktree(directory)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	err = worktree.Restore(&git.RestoreOptions{
		Staged:   true,
		Worktree: true,
		Files:    files,
	})

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	return nil
}

func Fetch(directory string, username *string, password *string) []byte {
	repo, err := getRepo(directory)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	auth := (*http.BasicAuth)(nil)
	if username != nil && password != nil {
		auth = &http.BasicAuth{
			Username: *username,
			Password: *password,
		}
	}

	err = repo.Fetch(&git.FetchOptions{
		Auth: auth,
	})

	if err != nil && err.Error() != "already up-to-date" {
		return serialize.SerializeString(errorFmt(err))
	}

	return nil
}

func Commit(directory string, commitMessage string, authorName string, authorEmail string) []byte {
	worktree, err := getWorktree(directory)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	_, err = worktree.Commit(commitMessage, &git.CommitOptions{
		All: true,
		Author: &object.Signature{
			Name:  authorName,
			Email: authorEmail,
			When:  time.Now(),
		},
	})

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	return nil
}

func getRemoteBranches(directory string, username *string, password *string) ([]plumbing.Reference, error) {
	repo, err := getRepo(directory)

	if err != nil {
		return nil, err
	}

	remote, err := repo.Remote("origin")

	if err != nil {
		return nil, err
	}

	auth := (*http.BasicAuth)(nil)
	if username != nil && password != nil {
		auth = &http.BasicAuth{
			Username: *username,
			Password: *password,
		}
	}

	remoteRefs, err := remote.List(&git.ListOptions{
		Auth: auth,
	})

	if err != nil {
		return nil, err
	}

	remoteBranches := []plumbing.Reference{}
	for _, r := range remoteRefs {
		if r.Name().IsBranch() {
			remoteBranches = append(remoteBranches, *r)
		}
	}

	return remoteBranches, nil
}

type Branch struct {
	Name   string
	Local  bool
	Remote bool
}

func Branches(directory string, username *string, password *string) []byte {
	repo, err := getRepo(directory)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	remoteBranches, err := getRemoteBranches(directory, username, password)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	branches := []Branch{}

	for _, r := range remoteBranches {
		branches = append(branches, Branch{
			Name:   r.Name().Short(),
			Remote: true,
			Local:  false,
		})
	}

	localRefs, err := repo.Branches()
	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	localRefs.ForEach(func(r *plumbing.Reference) error {
		for i := range branches {
			if branches[i].Name == r.Name().Short() {
				branches[i].Local = true
				return nil
			}
		}

		branches = append(branches, Branch{
			Name:   r.Name().Short(),
			Remote: false,
			Local:  true,
		})
		return nil
	})

	branchesSerialized := []byte{}

	for _, b := range branches {
		branchesSerialized = append(branchesSerialized, serialize.SerializeString(b.Name)...)
		branchesSerialized = append(branchesSerialized, serialize.SerializeBoolean(b.Remote)...)
		branchesSerialized = append(branchesSerialized, serialize.SerializeBoolean(b.Local)...)
	}

	return branchesSerialized
}

func Checkout(
	directory string,
	branch string,
	create bool,
	username *string,
	password *string,
) []byte {
	branchRefName := (*plumbing.ReferenceName)(nil)

	repo, err := getRepo(directory)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	localBranches, err := repo.Branches()

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	localBranches.ForEach(func(r *plumbing.Reference) error {
		if r.Name().Short() == branch {
			rName := r.Name()
			branchRefName = &rName
		}
		return nil
	})

	remoteBranches, err := getRemoteBranches(directory, username, password)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	refOnRemote := false
	for _, r := range remoteBranches {
		if r.Name().IsBranch() && r.Name().Short() == branch {
			rName := r.Name()
			branchRefName = &rName
			refOnRemote = true
			break
		}
	}

	if refOnRemote {
		auth := (*http.BasicAuth)(nil)
		if username != nil && password != nil {
			auth = &http.BasicAuth{
				Username: *username,
				Password: *password,
			}
		}

		remote, err := repo.Remote("origin")

		if err != nil {
			return serialize.SerializeString(errorFmt(err))
		}

		err = remote.Fetch(&git.FetchOptions{
			Auth:     auth,
			RefSpecs: []gitConfig.RefSpec{gitConfig.RefSpec(branchRefName.String() + ":" + branchRefName.String())},
		})

		if err != nil && err.Error() != "already up-to-date" {
			return serialize.SerializeString(errorFmt(err))
		}
	}

	worktree, err := getWorktree(directory)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	if branchRefName == nil {
		rName := plumbing.NewBranchReferenceName(branch)
		branchRefName = &rName
	}

	// checkout clears all untracked files
	stash := stashDirectory(path.Join(directory, "data"))

	err = worktree.Checkout(&git.CheckoutOptions{
		Branch: *branchRefName,
		Create: create,
	})

	restoreDirectory(stash)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	return nil
}

func BranchDelete(directory string, branch string) []byte {
	repo, err := getRepo(directory)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	err = repo.Storer.RemoveReference(plumbing.NewBranchReferenceName(branch))

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	return nil
}

type stashedDirectory struct {
	Id           string
	OriginalPath string
}

func stashDirectory(directory string) stashedDirectory {
	exists, isFile := fs.Exists(directory)
	if !exists || isFile {
		return stashedDirectory{}
	}

	stashId := utils.RandString(6)
	tmpDirectory := path.Join(setup.Directories.Tmp, stashId)
	fs.Rename(directory, tmpDirectory)
	return stashedDirectory{
		Id:           stashId,
		OriginalPath: directory,
	}
}

func restoreDirectory(stash stashedDirectory) {
	if stash.Id == "" {
		return
	}

	tmpDirectory := path.Join(setup.Directories.Tmp, stash.Id)
	exists, isFile := fs.Exists(tmpDirectory)
	if !exists || isFile {
		return
	}

	fs.Rename(tmpDirectory, stash.OriginalPath)
}
